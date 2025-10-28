import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Play, FileText, MessageSquare, Loader, CheckCircle, XCircle, Upload, Brain, TrendingUp, Target, Zap, FileUp, Sparkles } from 'lucide-react';
import './QuestionBank.css';

const QuestionBank = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('user_id') || localStorage.getItem('username');

  const [questionSets, setQuestionSets] = useState([]);
  const [chatSessions, setChatSessions] = useState([]);
  const [uploadedSlides, setUploadedSlides] = useState([]);
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCustomGenerateModal, setShowCustomGenerateModal] = useState(false);
  const [selectedQuestionSet, setSelectedQuestionSet] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState(null);
  const [adaptiveRecommendations, setAdaptiveRecommendations] = useState(null);

  const [selectedChats, setSelectedChats] = useState([]);
  const [selectedSlides, setSelectedSlides] = useState([]);
  const [questionCount, setQuestionCount] = useState(10);
  const [difficultyMix, setDifficultyMix] = useState({ easy: 3, medium: 5, hard: 2 });
  const [questionTypes, setQuestionTypes] = useState(['multiple_choice', 'true_false', 'short_answer']);

  const [selectedDocument, setSelectedDocument] = useState(null);
  const [customContent, setCustomContent] = useState('');
  const [generationMode, setGenerationMode] = useState('pdf');

  useEffect(() => {
    fetchQuestionSets();
    fetchChatSessions();
    fetchUploadedSlides();
    fetchUploadedDocuments();
    fetchAdaptiveRecommendations();
  }, []);

  const fetchQuestionSets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8001/get_question_sets?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setQuestionSets(data.question_sets || []);
      }
    } catch (error) {
      console.error('Error fetching question sets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChatSessions = async () => {
    try {
      const response = await fetch(`http://localhost:8001/get_chat_sessions?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setChatSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
    }
  };

  const fetchUploadedSlides = async () => {
    try {
      const response = await fetch(`http://localhost:8001/get_uploaded_slides?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUploadedSlides(data.slides || []);
      }
    } catch (error) {
      console.error('Error fetching slides:', error);
    }
  };

  const fetchUploadedDocuments = async () => {
    try {
      const response = await fetch(`http://localhost:8001/qb/get_uploaded_documents?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUploadedDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const fetchAdaptiveRecommendations = async () => {
    try {
      const response = await fetch(`http://localhost:8001/qb/get_adaptive_recommendations?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAdaptiveRecommendations(data);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8001/qb/upload_pdf?user_id=${userId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        alert(`PDF uploaded successfully! Detected topics: ${data.analysis.main_topics.join(', ')}`);
        await fetchUploadedDocuments();
        setShowUploadModal(false);
      } else {
        alert('Failed to upload PDF');
      }
    } catch (error) {
      console.error('Error uploading PDF:', error);
      alert('Error uploading PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFromPDF = async () => {
    if (!selectedDocument && !customContent) {
      alert('Please select a document or enter custom content');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('http://localhost:8001/qb/generate_from_pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userId,
          pdf_id: selectedDocument,
          content: customContent || null,
          question_count: questionCount,
          difficulty_mix: difficultyMix,
          question_types: questionTypes
        })
      });

      if (response.ok) {
        const data = await response.json();
        setShowCustomGenerateModal(false);
        await fetchQuestionSets();
        alert(`Successfully generated ${data.question_count} questions!`);
      } else {
        alert('Failed to generate questions');
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      alert('Error generating questions');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQuestions = async () => {
    if (selectedChats.length === 0 && selectedSlides.length === 0) {
      alert('Please select at least one source (chat or slide)');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('http://localhost:8001/generate_questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userId,
          chat_session_ids: selectedChats,
          slide_ids: selectedSlides,
          question_count: questionCount,
          difficulty_mix: difficultyMix
        })
      });

      if (response.ok) {
        const data = await response.json();
        setShowGenerateModal(false);
        setSelectedChats([]);
        setSelectedSlides([]);
        await fetchQuestionSets();
        alert(`Successfully generated ${data.question_count} questions!`);
      } else {
        alert('Failed to generate questions');
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      alert('Error generating questions');
    } finally {
      setLoading(false);
    }
  };

  const startPractice = (questionSetId) => {
    navigate(`/question-bank/${questionSetId}`);
  };

  const handleAnswerChange = (questionId, answer) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const submitAnswers = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8001/qb/submit_answers_adaptive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userId,
          question_set_id: selectedQuestionSet.id,
          answers: userAnswers
        })
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data);
        setShowResults(true);
        await fetchAdaptiveRecommendations();
      }
    } catch (error) {
      console.error('Error submitting answers:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSimilarQuestion = async (questionId) => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8001/qb/generate_similar_question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userId,
          question_set_id: selectedQuestionSet.id,
          question_id: questionId,
          difficulty: null
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert('Similar question generated! Refresh to see it.');
      }
    } catch (error) {
      console.error('Error generating similar question:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteQuestionSet = async (questionSetId) => {
    if (!window.confirm('Delete this question set?')) return;

    try {
      const response = await fetch(`http://localhost:8001/delete_question_set/${questionSetId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        await fetchQuestionSets();
      }
    } catch (error) {
      console.error('Error deleting question set:', error);
    }
  };

  const toggleQuestionType = (type) => {
    setQuestionTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="qb-page">
      <header className="qb-header">
        <div className="qb-header-container">
          <div className="qb-header-left">
            <button className="qb-back-btn" onClick={() => navigate('/learning-review')}>
              <ArrowLeft size={20} />
              <span>BACK</span>
            </button>
            <div className="qb-header-title-group">
              <h1 className="qb-logo">brainwave</h1>
              <span className="qb-subtitle">QUESTION BANK</span>
            </div>
          </div>
          <div className="qb-header-right">
            <button className="qb-nav-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
            <button className="qb-nav-btn logout" onClick={() => { localStorage.clear(); navigate('/login'); }}>Logout</button>
          </div>
        </div>
      </header>

      <div className="qb-content">
        <section className="qb-section-header">
          <div className="qb-header-content">
            <div>
              <h2 className="qb-section-title">Intelligent Question Bank</h2>
              <p className="qb-section-subtitle">AI-powered adaptive learning with smart question generation</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="qb-generate-btn" onClick={() => setShowUploadModal(true)}>
                <Upload size={18} />
                Upload PDF
              </button>
              <button className="qb-generate-btn" onClick={() => setShowCustomGenerateModal(true)}>
                <Sparkles size={18} />
                Generate Custom
              </button>
              <button className="qb-generate-btn" onClick={() => setShowGenerateModal(true)}>
                <Plus size={18} />
                From Chats/Slides
              </button>
            </div>
          </div>
        </section>

        {adaptiveRecommendations && (
          <div className="qb-adaptive-banner">
            <div className="qb-adaptive-header">
              <Brain size={24} />
              <h3>AI Performance Insights</h3>
            </div>
            <div className="qb-adaptive-stats">
              <div className="qb-adaptive-stat">
                <TrendingUp size={20} />
                <div>
                  <span className="qb-stat-label">Recommended Level</span>
                  <span className="qb-stat-value">{adaptiveRecommendations.performance_analysis?.recommended_difficulty || 'Medium'}</span>
                </div>
              </div>
              <div className="qb-adaptive-stat">
                <Target size={20} />
                <div>
                  <span className="qb-stat-label">Focus</span>
                  <span className="qb-stat-value">{adaptiveRecommendations.performance_analysis?.reason || 'Building skills'}</span>
                </div>
              </div>
              <div className="qb-adaptive-stat">
                <Zap size={20} />
                <div>
                  <span className="qb-stat-label">Sessions Analyzed</span>
                  <span className="qb-stat-value">{adaptiveRecommendations.recent_sessions || 0}</span>
                </div>
              </div>
            </div>
            {adaptiveRecommendations.recommended_topics && adaptiveRecommendations.recommended_topics.length > 0 && (
              <div className="qb-recommended-topics">
                <span className="qb-topics-label">Recommended Topics:</span>
                <div className="qb-topics-list">
                  {adaptiveRecommendations.recommended_topics.map((topic, idx) => (
                    <span key={idx} className="qb-topic-chip">{topic}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <main className="qb-main">
          {loading && questionSets.length === 0 ? (
            <div className="qb-loading">
              <Loader className="qb-spinner" size={48} />
              <p>Loading question sets...</p>
            </div>
          ) : questionSets.length === 0 ? (
            <div className="qb-empty">
              <FileText size={64} style={{ opacity: 0.3 }} />
              <h3>No Question Sets Yet</h3>
              <p>Upload a PDF, generate from your content, or create custom questions to get started!</p>
            </div>
          ) : (
            <div className="qb-grid">
              {questionSets.map(set => (
                <div key={set.id} className="qb-card">
                  <div className="qb-card-header">
                    <div className="qb-card-icon">
                      <FileText size={28} />
                    </div>
                    <button className="qb-delete-btn" onClick={() => deleteQuestionSet(set.id)}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div className="qb-card-content">
                    <h3 className="qb-card-title">{set.title}</h3>
                    <p className="qb-card-description">{set.description}</p>
                    <div className="qb-card-stats">
                      <div className="qb-stat-item">
                        <span className="qb-stat-label">Questions</span>
                        <span className="qb-stat-value">{set.total_questions}</span>
                      </div>
                      <div className="qb-stat-item">
                        <span className="qb-stat-label">Best Score</span>
                        <span className="qb-stat-value">{set.best_score || 0}%</span>
                      </div>
                      <div className="qb-stat-item">
                        <span className="qb-stat-label">Attempts</span>
                        <span className="qb-stat-value">{set.attempts || 0}</span>
                      </div>
                    </div>
                  </div>
                  <div className="qb-card-footer">
                    <button className="qb-start-btn" onClick={() => startPractice(set.id)}>
                      <Play size={16} />
                      Start Practice
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {showUploadModal && (
        <div className="qb-modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="qb-modal qb-upload-modal" onClick={e => e.stopPropagation()}>
            <div className="qb-modal-header">
              <h3>Upload PDF for Question Generation</h3>
              <button className="qb-modal-close" onClick={() => setShowUploadModal(false)}>×</button>
            </div>
            <div className="qb-modal-content">
              <div className="qb-upload-area">
                <FileUp size={48} />
                <p>Select a PDF document to analyze and generate questions from</p>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  style={{ marginTop: '20px' }}
                />
              </div>
              {uploadedDocuments.length > 0 && (
                <div className="qb-documents-list">
                  <h4>Previously Uploaded Documents</h4>
                  {uploadedDocuments.map(doc => (
                    <div key={doc.id} className="qb-document-item">
                      <FileText size={20} />
                      <div>
                        <span>{doc.filename}</span>
                        <span className="qb-doc-date">{new Date(doc.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCustomGenerateModal && (
        <div className="qb-modal-overlay" onClick={() => setShowCustomGenerateModal(false)}>
          <div className="qb-modal qb-generate-modal" onClick={e => e.stopPropagation()}>
            <div className="qb-modal-header">
              <h3>Generate Custom Questions</h3>
              <button className="qb-modal-close" onClick={() => setShowCustomGenerateModal(false)}>×</button>
            </div>
            <div className="qb-modal-content">
              <div className="qb-source-tabs">
                <button
                  className={`qb-source-tab ${generationMode === 'pdf' ? 'active' : ''}`}
                  onClick={() => setGenerationMode('pdf')}
                >
                  <FileText size={18} />
                  From PDF
                </button>
                <button
                  className={`qb-source-tab ${generationMode === 'custom' ? 'active' : ''}`}
                  onClick={() => setGenerationMode('custom')}
                >
                  <MessageSquare size={18} />
                  Custom Content
                </button>
              </div>

              {generationMode === 'pdf' ? (
                <div className="qb-form-group">
                  <label>Select Document:</label>
                  <select
                    value={selectedDocument || ''}
                    onChange={e => setSelectedDocument(parseInt(e.target.value))}
                    className="qb-select"
                  >
                    <option value="">Choose a document...</option>
                    {uploadedDocuments.map(doc => (
                      <option key={doc.id} value={doc.id}>{doc.filename}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="qb-form-group">
                  <label>Enter Content:</label>
                  <textarea
                    value={customContent}
                    onChange={e => setCustomContent(e.target.value)}
                    className="qb-textarea"
                    rows={6}
                    placeholder="Paste your study material, notes, or any content here..."
                  />
                </div>
              )}

              <div className="qb-form-group">
                <label>Number of Questions: {questionCount}</label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={questionCount}
                  onChange={e => setQuestionCount(parseInt(e.target.value))}
                  className="qb-slider"
                />
              </div>

              <div className="qb-form-group">
                <label>Question Types:</label>
                <div className="qb-question-types">
                  {[
                    { value: 'multiple_choice', label: 'Multiple Choice' },
                    { value: 'true_false', label: 'True/False' },
                    { value: 'short_answer', label: 'Short Answer' },
                    { value: 'fill_blank', label: 'Fill in the Blank' }
                  ].map(type => (
                    <label key={type.value} className="qb-checkbox-label">
                      <input
                        type="checkbox"
                        checked={questionTypes.includes(type.value)}
                        onChange={() => toggleQuestionType(type.value)}
                      />
                      <span>{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="qb-form-group">
                <label>Difficulty Distribution:</label>
                <div className="qb-difficulty-inputs">
                  <div className="qb-difficulty-input">
                    <label>Easy:</label>
                    <input
                      type="number"
                      min="0"
                      max={questionCount}
                      value={difficultyMix.easy}
                      onChange={e => setDifficultyMix({ ...difficultyMix, easy: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="qb-difficulty-input">
                    <label>Medium:</label>
                    <input
                      type="number"
                      min="0"
                      max={questionCount}
                      value={difficultyMix.medium}
                      onChange={e => setDifficultyMix({ ...difficultyMix, medium: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="qb-difficulty-input">
                    <label>Hard:</label>
                    <input
                      type="number"
                      min="0"
                      max={questionCount}
                      value={difficultyMix.hard}
                      onChange={e => setDifficultyMix({ ...difficultyMix, hard: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="qb-modal-footer">
              <button className="qb-btn-cancel" onClick={() => setShowCustomGenerateModal(false)}>Cancel</button>
              <button className="qb-btn-generate" onClick={handleGenerateFromPDF} disabled={loading}>
                {loading ? 'Generating...' : 'Generate Questions'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showGenerateModal && (
        <div className="qb-modal-overlay" onClick={() => setShowGenerateModal(false)}>
          <div className="qb-modal qb-generate-modal" onClick={e => e.stopPropagation()}>
            <div className="qb-modal-header">
              <h3>Generate Questions from Your Content</h3>
              <button className="qb-modal-close" onClick={() => setShowGenerateModal(false)}>×</button>
            </div>
            <div className="qb-modal-content">
              <div className="qb-form-group">
                <label>Select Chat Sessions:</label>
                {chatSessions.length === 0 ? (
                  <p className="qb-empty-message">No chat sessions available</p>
                ) : (
                  <div className="qb-selection-list">
                    {chatSessions.map(session => (
                      <label key={session.id} className="qb-checkbox-label">
                        <input
                          type="checkbox"
                          checked={selectedChats.includes(session.id)}
                          onChange={() => {
                            setSelectedChats(prev =>
                              prev.includes(session.id)
                                ? prev.filter(id => id !== session.id)
                                : [...prev, session.id]
                            );
                          }}
                        />
                        <span>{session.title}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="qb-form-group">
                <label>Select Slides:</label>
                {uploadedSlides.length === 0 ? (
                  <p className="qb-empty-message">No slides available</p>
                ) : (
                  <div className="qb-selection-list">
                    {uploadedSlides.map(slide => (
                      <label key={slide.id} className="qb-checkbox-label">
                        <input
                          type="checkbox"
                          checked={selectedSlides.includes(slide.id)}
                          onChange={() => {
                            setSelectedSlides(prev =>
                              prev.includes(slide.id)
                                ? prev.filter(id => id !== slide.id)
                                : [...prev, slide.id]
                            );
                          }}
                        />
                        <span>{slide.filename}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="qb-form-group">
                <label>Number of Questions: {questionCount}</label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={questionCount}
                  onChange={e => setQuestionCount(parseInt(e.target.value))}
                  className="qb-slider"
                />
              </div>

              <div className="qb-form-group">
                <label>Difficulty Distribution:</label>
                <div className="qb-difficulty-inputs">
                  <div className="qb-difficulty-input">
                    <label>Easy:</label>
                    <input
                      type="number"
                      min="0"
                      max={questionCount}
                      value={difficultyMix.easy}
                      onChange={e => setDifficultyMix({ ...difficultyMix, easy: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="qb-difficulty-input">
                    <label>Medium:</label>
                    <input
                      type="number"
                      min="0"
                      max={questionCount}
                      value={difficultyMix.medium}
                      onChange={e => setDifficultyMix({ ...difficultyMix, medium: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="qb-difficulty-input">
                    <label>Hard:</label>
                    <input
                      type="number"
                      min="0"
                      max={questionCount}
                      value={difficultyMix.hard}
                      onChange={e => setDifficultyMix({ ...difficultyMix, hard: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="qb-modal-footer">
              <button className="qb-btn-cancel" onClick={() => setShowGenerateModal(false)}>Cancel</button>
              <button className="qb-btn-generate" onClick={handleGenerateQuestions} disabled={loading}>
                {loading ? 'Generating...' : 'Generate Questions'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPracticeModal && selectedQuestionSet && (
        <div className="qb-modal-overlay" onClick={() => setShowPracticeModal(false)}>
          <div className="qb-modal qb-practice-modal" onClick={e => e.stopPropagation()}>
            <div className="qb-modal-header">
              <h3>{selectedQuestionSet.title}</h3>
              <button className="qb-modal-close" onClick={() => setShowPracticeModal(false)}>×</button>
            </div>

            <div className="qb-modal-content">
              {!showResults ? (
                <>
                  <div className="qb-progress">
                    <span>Question {currentQuestion + 1} of {selectedQuestionSet.questions.length}</span>
                    <div className="qb-progress-bar">
                      <div 
                        className="qb-progress-fill" 
                        style={{ width: `${((currentQuestion + 1) / selectedQuestionSet.questions.length) * 100}%` }}
                      />
                    </div>
                  </div>

                  {selectedQuestionSet.questions.map((q, idx) => (
                    <div 
                      key={q.id} 
                      className={`qb-question-container ${idx === currentQuestion ? 'active' : ''}`}
                      style={{ display: idx === currentQuestion ? 'block' : 'none' }}
                    >
                      <div className="qb-question-header">
                        <span className={`qb-difficulty-badge ${q.difficulty}`}>{q.difficulty}</span>
                        <span className="qb-topic-badge">{q.topic}</span>
                        <button 
                          className="qb-similar-btn"
                          onClick={() => generateSimilarQuestion(q.id)}
                          title="Generate similar question"
                        >
                          <Sparkles size={16} />
                        </button>
                      </div>

                      <p className="qb-question-text">{q.question_text}</p>

                      {q.question_type === 'multiple_choice' && (
                        <div className="qb-options">
                          {q.options.map((option, optIdx) => (
                            <label key={optIdx} className="qb-option">
                              <input
                                type="radio"
                                name={`question-${q.id}`}
                                value={option}
                                checked={userAnswers[q.id] === option}
                                onChange={() => handleAnswerChange(q.id, option)}
                              />
                              <span>{option}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {q.question_type === 'true_false' && (
                        <div className="qb-options">
                          <label className="qb-option">
                            <input
                              type="radio"
                              name={`question-${q.id}`}
                              value="true"
                              checked={userAnswers[q.id] === 'true'}
                              onChange={() => handleAnswerChange(q.id, 'true')}
                            />
                            <span>True</span>
                          </label>
                          <label className="qb-option">
                            <input
                              type="radio"
                              name={`question-${q.id}`}
                              value="false"
                              checked={userAnswers[q.id] === 'false'}
                              onChange={() => handleAnswerChange(q.id, 'false')}
                            />
                            <span>False</span>
                          </label>
                        </div>
                      )}

                      {(q.question_type === 'short_answer' || q.question_type === 'fill_blank') && (
                        <textarea
                          className="qb-textarea"
                          value={userAnswers[q.id] || ''}
                          onChange={e => handleAnswerChange(q.id, e.target.value)}
                          placeholder="Type your answer here..."
                          rows={4}
                        />
                      )}
                    </div>
                  ))}

                  <div className="qb-navigation-btns">
                    <button 
                      className="qb-nav-prev"
                      onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                      disabled={currentQuestion === 0}
                    >
                      Previous
                    </button>
                    {currentQuestion < selectedQuestionSet.questions.length - 1 ? (
                      <button 
                        className="qb-nav-next"
                        onClick={() => setCurrentQuestion(currentQuestion + 1)}
                      >
                        Next
                      </button>
                    ) : (
                      <button 
                        className="qb-submit-btn"
                        onClick={submitAnswers}
                        disabled={loading}
                      >
                        {loading ? 'Submitting...' : 'Submit Answers'}
                      </button>
                    )}
                  </div>
                </>
              ) : results && (
                <div className="qb-results">
                  <div className="qb-results-header">
                    <div className="qb-score-circle">
                      <span className="qb-score-value">{results.score}%</span>
                      <span className="qb-score-label">Score</span>
                    </div>
                    <div className="qb-results-stats">
                      <div className="qb-result-stat correct">
                        <CheckCircle size={24} />
                        <span>{results.correct_count} Correct</span>
                      </div>
                      <div className="qb-result-stat incorrect">
                        <XCircle size={24} />
                        <span>{results.total_questions - results.correct_count} Incorrect</span>
                      </div>
                    </div>
                  </div>

                  {results.adaptation && (
                    <div className="qb-adaptation-box">
                      <h4>AI Recommendation</h4>
                      <p><strong>Next Difficulty:</strong> {results.adaptation.recommended_difficulty}</p>
                      <p>{results.adaptation.reason}</p>
                      <div className="qb-suggested-distribution">
                        <span>Suggested Mix:</span>
                        <span>Easy: {results.adaptation.suggested_distribution.easy}</span>
                        <span>Medium: {results.adaptation.suggested_distribution.medium}</span>
                        <span>Hard: {results.adaptation.suggested_distribution.hard}</span>
                      </div>
                    </div>
                  )}

                  <div className="qb-results-details">
                    <h4>Review Your Answers</h4>
                    {results.details.map((detail, idx) => (
                      <div key={idx} className={`qb-result-item ${detail.is_correct ? 'correct' : 'incorrect'}`}>
                        <div className="qb-result-indicator">
                          {detail.is_correct ? <CheckCircle size={20} /> : <XCircle size={20} />}
                        </div>
                        <div className="qb-result-content">
                          <p className="qb-result-question"><strong>Q{idx + 1}:</strong> {detail.topic}</p>
                          <p className="qb-result-answer">
                            <strong>Your answer:</strong> {detail.user_answer || 'No answer'}
                          </p>
                          {!detail.is_correct && (
                            <p className="qb-result-correct">
                              <strong>Correct answer:</strong> {detail.correct_answer}
                            </p>
                          )}
                          {detail.explanation && (
                            <p className="qb-result-explanation">{detail.explanation}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button 
                    className="qb-btn-close-results"
                    onClick={() => {
                      setShowPracticeModal(false);
                      setShowResults(false);
                      fetchQuestionSets();
                    }}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionBank;