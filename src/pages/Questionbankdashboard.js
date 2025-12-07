import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Upload, MessageSquare, Sparkles, FileText, BarChart3, 
  Plus, Play, Trash2, TrendingUp, Target, Brain, Zap, Award, 
  CheckCircle, XCircle, Loader, Clock, FileUp, BookOpen, PieChart
} from 'lucide-react';
import './Questionbankdashboard.css';
import { API_URL } from '../config';
const QuestionBankDashboard = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('user_id') || localStorage.getItem('username');

  const [activeView, setActiveView] = useState('question-sets');
  const [questionSets, setQuestionSets] = useState([]);
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [chatSessions, setChatSessions] = useState([]);
  const [uploadedSlides, setUploadedSlides] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showStudyModal, setShowStudyModal] = useState(false);

  const [selectedDocument, setSelectedDocument] = useState(null);
  const [selectedSources, setSelectedSources] = useState([]);
  const [customContent, setCustomContent] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [difficultyMix, setDifficultyMix] = useState({ easy: 3, medium: 5, hard: 2 });
  const [questionTypes, setQuestionTypes] = useState(['multiple_choice', 'true_false', 'short_answer']);

  const [selectedQuestionSet, setSelectedQuestionSet] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState(null);
  const [sessionStartTime, setSessionStartTime] = useState(null);

  useEffect(() => {
    fetchQuestionSets();
    fetchUploadedDocuments();
    fetchChatSessions();
    fetchUploadedSlides();
    if (activeView === 'analytics') {
      fetchAnalytics();
    }
  }, [activeView]);

  const fetchQuestionSets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/qb/get_question_sets?user_id=${userId}`, {
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

  const fetchUploadedDocuments = async () => {
    try {
      const response = await fetch(`${API_URL}/qb/get_uploaded_documents?user_id=${userId}`, {
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

  const fetchChatSessions = async () => {
    try {
      const response = await fetch(`${API_URL}/get_chat_sessions?user_id=${userId}`, {
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
      const response = await fetch(`${API_URL}/get_uploaded_slides?user_id=${userId}`, {
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

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/qb/get_analytics?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/qb/upload_pdf?user_id=${userId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        alert(`PDF uploaded successfully! Document type: ${data.analysis.document_type}`);
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
    if (!selectedDocument) {
      alert('Please select a PDF document');
      return;
    }

    if (questionTypes.length === 0) {
      alert('Please select at least one question type');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/qb/generate_from_pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userId,
          source_type: 'pdf',
          source_id: selectedDocument,
          question_count: questionCount,
          difficulty_mix: difficultyMix,
          question_types: questionTypes
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Successfully generated ${data.question_count} questions!`);
        setShowUploadModal(false);
        setSelectedDocument(null);
        await fetchQuestionSets();
        setActiveView('question-sets');
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

  const handleGenerateFromChatSlides = async () => {
    if (selectedSources.length === 0) {
      alert('Please select at least one source');
      return;
    }

    if (questionTypes.length === 0) {
      alert('Please select at least one question type');
      return;
    }

    try {
      setLoading(true);
      const promises = selectedSources.map(source => {
        return fetch(`${API_URL}/qb/generate_from_chat_slides`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            user_id: userId,
            source_type: source.type,
            source_id: source.id,
            question_count: Math.floor(questionCount / selectedSources.length),
            difficulty_mix: difficultyMix,
            question_types: questionTypes
          })
        });
      });

      const responses = await Promise.all(promises);
      const allSuccess = responses.every(r => r.ok);

      if (allSuccess) {
        alert(`Successfully generated questions from ${selectedSources.length} sources!`);
        setShowGenerateModal(false);
        setSelectedSources([]);
        await fetchQuestionSets();
        setActiveView('question-sets');
      } else {
        alert('Some questions failed to generate');
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      alert('Error generating questions');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCustom = async () => {
    if (!customContent.trim()) {
      alert('Please enter some content');
      return;
    }

    if (questionTypes.length === 0) {
      alert('Please select at least one question type');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/qb/generate_from_pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userId,
          source_type: 'custom',
          content: customContent,
          title: customTitle || 'Custom Question Set',
          question_count: questionCount,
          difficulty_mix: difficultyMix,
          question_types: questionTypes
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Successfully generated ${data.question_count} questions!`);
        setShowCustomModal(false);
        setCustomContent('');
        setCustomTitle('');
        await fetchQuestionSets();
        setActiveView('question-sets');
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

  const startStudySession = async (setId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/qb/get_question_set/${setId}?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedQuestionSet(data);
        setCurrentQuestion(0);
        setUserAnswers({});
        setShowResults(false);
        setResults(null);
        setSessionStartTime(Date.now());
        setShowStudyModal(true);
      }
    } catch (error) {
      console.error('Error loading question set:', error);
      alert('Error loading questions');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId, answer) => {
    setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const submitAnswers = async () => {
    const timeTaken = Math.floor((Date.now() - sessionStartTime) / 1000);

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/qb/submit_answers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userId,
          question_set_id: selectedQuestionSet.id,
          answers: userAnswers,
          time_taken_seconds: timeTaken
        })
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data);
        setShowResults(true);
        await fetchQuestionSets();
        if (activeView === 'analytics') {
          await fetchAnalytics();
        }
      }
    } catch (error) {
      console.error('Error submitting answers:', error);
      alert('Error submitting answers');
    } finally {
      setLoading(false);
    }
  };

  const deleteQuestionSet = async (setId) => {
    if (!window.confirm('Are you sure you want to delete this question set?')) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/qb/delete_question_set/${setId}?user_id=${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        await fetchQuestionSets();
      }
    } catch (error) {
      console.error('Error deleting question set:', error);
      alert('Error deleting question set');
    } finally {
      setLoading(false);
    }
  };

  const toggleSourceSelection = (type, id, title) => {
    const sourceKey = `${type}-${id}`;
    const exists = selectedSources.find(s => `${s.type}-${s.id}` === sourceKey);
    
    if (exists) {
      setSelectedSources(selectedSources.filter(s => `${s.type}-${s.id}` !== sourceKey));
    } else {
      setSelectedSources([...selectedSources, { type, id, title }]);
    }
  };

  const generateSimilarQuestion = async (questionId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/qb/generate_similar_question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userId,
          question_id: questionId,
          difficulty: null
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert('Similar question generated successfully! Added to your question set.');
        await fetchQuestionSets();
      } else {
        alert('Failed to generate similar question');
      }
    } catch (error) {
      console.error('Error generating similar question:', error);
      alert('Error generating similar question');
    } finally {
      setLoading(false);
    }
  };

  const renderSidebar = () => (
    <div className="qbd-sidebar">
      <div className="qbd-sidebar-header">
        <Brain className="qbd-sidebar-logo-icon" size={28} />
        <div className="qbd-sidebar-title">Question Bank</div>
      </div>

      <nav className="qbd-sidebar-nav">
        <button 
          className={`qbd-sidebar-item ${activeView === 'upload-pdf' ? 'active' : ''}`}
          onClick={() => setActiveView('upload-pdf')}
        >
          <Upload size={20} />
          <span>Upload PDF</span>
        </button>

        <button 
          className={`qbd-sidebar-item ${activeView === 'chat-slides' ? 'active' : ''}`}
          onClick={() => setActiveView('chat-slides')}
        >
          <MessageSquare size={20} />
          <span>AI Chat & Slides</span>
        </button>

        <button 
          className={`qbd-sidebar-item ${activeView === 'custom' ? 'active' : ''}`}
          onClick={() => setActiveView('custom')}
        >
          <Sparkles size={20} />
          <span>Generate Custom</span>
        </button>

        <button 
          className={`qbd-sidebar-item ${activeView === 'question-sets' ? 'active' : ''}`}
          onClick={() => setActiveView('question-sets')}
        >
          <FileText size={20} />
          <span>All Question Sets</span>
        </button>

        <button 
          className={`qbd-sidebar-item ${activeView === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveView('analytics')}
        >
          <BarChart3 size={20} />
          <span>Analytics</span>
        </button>
      </nav>

      <button className="qbd-sidebar-back" onClick={() => navigate('/dashboard')}>
        <ArrowLeft size={18} />
        <span>Back to Dashboard</span>
      </button>
    </div>
  );

  const renderUploadPDF = () => (
    <div className="qbd-view">
      <div className="qbd-view-header">
        <div className="qbd-view-title-group">
          <Upload className="qbd-view-icon" size={32} />
          <div>
            <h2 className="qbd-view-title">Upload PDF Questions</h2>
            <p className="qbd-view-subtitle">Upload any PDF with questions and generate similar ones</p>
          </div>
        </div>
      </div>

      <div className="qbd-content-grid">
        <div className="qbd-upload-section">
          <div className="qbd-upload-box">
            <FileUp size={48} />
            <h3>Upload Your PDF</h3>
            <p>Upload a PDF containing questions to analyze and generate similar ones</p>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              id="pdf-upload-input"
            />
            <label htmlFor="pdf-upload-input" className="qbd-btn-primary">
              {loading ? <Loader className="qbd-spin" size={18} /> : <Upload size={18} />}
              <span>{loading ? 'Uploading...' : 'Choose PDF File'}</span>
            </label>
          </div>
        </div>

        {uploadedDocuments.length > 0 && (
          <div className="qbd-documents-section">
            <h3 className="qbd-section-title">
              <BookOpen size={20} />
              Uploaded Documents ({uploadedDocuments.length})
            </h3>
            <div className="qbd-documents-grid">
              {uploadedDocuments.map(doc => (
                <div 
                  key={doc.id} 
                  className={`qbd-document-card ${selectedDocument === doc.id ? 'selected' : ''}`}
                  onClick={() => setSelectedDocument(doc.id)}
                >
                  <div className="qbd-document-header">
                    <FileText size={24} />
                    <div className="qbd-document-info">
                      <h4>{doc.filename}</h4>
                      <p>{doc.document_type}</p>
                    </div>
                  </div>
                  {doc.analysis && (
                    <div className="qbd-document-topics">
                      {doc.analysis.main_topics?.slice(0, 3).map((topic, idx) => (
                        <span key={idx} className="qbd-topic-tag">{topic}</span>
                      ))}
                    </div>
                  )}
                  <div className="qbd-document-footer">
                    <span className="qbd-document-date">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {selectedDocument && (
              <div className="qbd-generation-settings">
                <h3 className="qbd-section-title">Generation Settings</h3>
                
                <div className="qbd-setting-group">
                  <label>Number of Questions</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                    className="qbd-input"
                  />
                </div>

                <div className="qbd-setting-group">
                  <label>Difficulty Mix</label>
                  <div className="qbd-difficulty-sliders">
                    <div className="qbd-slider-item">
                      <span>Easy: {difficultyMix.easy}</span>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={difficultyMix.easy}
                        onChange={(e) => setDifficultyMix({...difficultyMix, easy: parseInt(e.target.value)})}
                      />
                    </div>
                    <div className="qbd-slider-item">
                      <span>Medium: {difficultyMix.medium}</span>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={difficultyMix.medium}
                        onChange={(e) => setDifficultyMix({...difficultyMix, medium: parseInt(e.target.value)})}
                      />
                    </div>
                    <div className="qbd-slider-item">
                      <span>Hard: {difficultyMix.hard}</span>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={difficultyMix.hard}
                        onChange={(e) => setDifficultyMix({...difficultyMix, hard: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>
                </div>

                <div className="qbd-setting-group">
                  <label>Question Types</label>
                  <div className="qbd-checkbox-group">
                    {['multiple_choice', 'true_false', 'short_answer', 'fill_blank'].map(type => (
                      <label key={type} className="qbd-checkbox-label">
                        <input
                          type="checkbox"
                          checked={questionTypes.includes(type)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setQuestionTypes([...questionTypes, type]);
                            } else {
                              setQuestionTypes(questionTypes.filter(t => t !== type));
                            }
                          }}
                        />
                        <span>{type.replace(/_/g, ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button 
                  className="qbd-btn-primary qbd-btn-large"
                  onClick={handleGenerateFromPDF}
                  disabled={loading}
                >
                  {loading ? <Loader className="qbd-spin" size={18} /> : <Sparkles size={18} />}
                  <span>{loading ? 'Generating...' : 'Generate Questions'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderChatSlides = () => (
    <div className="qbd-view">
      <div className="qbd-view-header">
        <div className="qbd-view-title-group">
          <MessageSquare className="qbd-view-icon" size={32} />
          <div>
            <h2 className="qbd-view-title">AI Chat & Slides</h2>
            <p className="qbd-view-subtitle">Generate questions from your AI conversations and slide presentations</p>
          </div>
        </div>
      </div>

      <div className="qbd-content-sections">
        <div className="qbd-source-section">
          <h3 className="qbd-section-title">
            <MessageSquare size={20} />
            AI Chat Sessions ({chatSessions.length})
          </h3>
          <div className="qbd-source-grid">
            {chatSessions.map(chat => {
              const isSelected = selectedSources.some(s => s.type === 'chat' && s.id === chat.id);
              return (
                <div 
                  key={chat.id}
                  className={`qbd-source-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleSourceSelection('chat', chat.id, chat.title)}
                >
                  <div className="qbd-source-check">
                    {isSelected && <CheckCircle size={20} />}
                  </div>
                  <MessageSquare size={24} />
                  <h4>{chat.title}</h4>
                  <p>{new Date(chat.created_at).toLocaleDateString()}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="qbd-source-section">
          <h3 className="qbd-section-title">
            <FileText size={20} />
            Uploaded Slides ({uploadedSlides.length})
          </h3>
          <div className="qbd-source-grid">
            {uploadedSlides.map(slide => {
              const isSelected = selectedSources.some(s => s.type === 'slide' && s.id === slide.id);
              return (
                <div 
                  key={slide.id}
                  className={`qbd-source-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleSourceSelection('slide', slide.id, slide.title)}
                >
                  <div className="qbd-source-check">
                    {isSelected && <CheckCircle size={20} />}
                  </div>
                  <FileText size={24} />
                  <h4>{slide.title}</h4>
                  <p>{new Date(slide.created_at).toLocaleDateString()}</p>
                </div>
              );
            })}
          </div>
        </div>

        {selectedSources.length > 0 && (
          <div className="qbd-generation-settings">
            <h3 className="qbd-section-title">
              Selected Sources ({selectedSources.length})
            </h3>
            <div className="qbd-selected-sources">
              {selectedSources.map((source, idx) => (
                <span key={idx} className="qbd-selected-tag">
                  {source.title}
                  <button onClick={() => toggleSourceSelection(source.type, source.id, source.title)}>×</button>
                </span>
              ))}
            </div>

            <div className="qbd-setting-group">
              <label>Total Questions</label>
              <input
                type="number"
                min="1"
                max="50"
                value={questionCount}
                onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                className="qbd-input"
              />
            </div>

            <div className="qbd-setting-group">
              <label>Difficulty Mix</label>
              <div className="qbd-difficulty-sliders">
                <div className="qbd-slider-item">
                  <span>Easy: {difficultyMix.easy}</span>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={difficultyMix.easy}
                    onChange={(e) => setDifficultyMix({...difficultyMix, easy: parseInt(e.target.value)})}
                  />
                </div>
                <div className="qbd-slider-item">
                  <span>Medium: {difficultyMix.medium}</span>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={difficultyMix.medium}
                    onChange={(e) => setDifficultyMix({...difficultyMix, medium: parseInt(e.target.value)})}
                  />
                </div>
                <div className="qbd-slider-item">
                  <span>Hard: {difficultyMix.hard}</span>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={difficultyMix.hard}
                    onChange={(e) => setDifficultyMix({...difficultyMix, hard: parseInt(e.target.value)})}
                  />
                </div>
              </div>
            </div>

            <button 
              className="qbd-btn-primary qbd-btn-large"
              onClick={handleGenerateFromChatSlides}
              disabled={loading}
            >
              {loading ? <Loader className="qbd-spin" size={18} /> : <Sparkles size={18} />}
              <span>{loading ? 'Generating...' : 'Generate Questions'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderCustom = () => (
    <div className="qbd-view">
      <div className="qbd-view-header">
        <div className="qbd-view-title-group">
          <Sparkles className="qbd-view-icon" size={32} />
          <div>
            <h2 className="qbd-view-title">Generate Custom Questions</h2>
            <p className="qbd-view-subtitle">Enter any content and let AI create practice questions</p>
          </div>
        </div>
      </div>

      <div className="qbd-custom-container">
        <div className="qbd-setting-group">
          <label>Question Set Title</label>
          <input
            type="text"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="e.g., Physics Chapter 5 Review"
            className="qbd-input"
          />
        </div>

        <div className="qbd-setting-group">
          <label>Content (paste notes, articles, or any study material)</label>
          <textarea
            value={customContent}
            onChange={(e) => setCustomContent(e.target.value)}
            placeholder="Paste your content here..."
            className="qbd-textarea-large"
            rows={12}
          />
        </div>

        <div className="qbd-settings-row">
          <div className="qbd-setting-group">
            <label>Number of Questions</label>
            <input
              type="number"
              min="1"
              max="50"
              value={questionCount}
              onChange={(e) => setQuestionCount(parseInt(e.target.value))}
              className="qbd-input"
            />
          </div>
        </div>

        <div className="qbd-setting-group">
          <label>Difficulty Mix</label>
          <div className="qbd-difficulty-sliders">
            <div className="qbd-slider-item">
              <span>Easy: {difficultyMix.easy}</span>
              <input
                type="range"
                min="0"
                max="10"
                value={difficultyMix.easy}
                onChange={(e) => setDifficultyMix({...difficultyMix, easy: parseInt(e.target.value)})}
              />
            </div>
            <div className="qbd-slider-item">
              <span>Medium: {difficultyMix.medium}</span>
              <input
                type="range"
                min="0"
                max="10"
                value={difficultyMix.medium}
                onChange={(e) => setDifficultyMix({...difficultyMix, medium: parseInt(e.target.value)})}
              />
            </div>
            <div className="qbd-slider-item">
              <span>Hard: {difficultyMix.hard}</span>
              <input
                type="range"
                min="0"
                max="10"
                value={difficultyMix.hard}
                onChange={(e) => setDifficultyMix({...difficultyMix, hard: parseInt(e.target.value)})}
              />
            </div>
          </div>
        </div>

        <div className="qbd-setting-group">
          <label>Question Types</label>
          <div className="qbd-checkbox-group">
            {['multiple_choice', 'true_false', 'short_answer', 'fill_blank'].map(type => (
              <label key={type} className="qbd-checkbox-label">
                <input
                  type="checkbox"
                  checked={questionTypes.includes(type)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setQuestionTypes([...questionTypes, type]);
                    } else {
                      setQuestionTypes(questionTypes.filter(t => t !== type));
                    }
                  }}
                />
                <span>{type.replace(/_/g, ' ')}</span>
              </label>
            ))}
          </div>
        </div>

        <button 
          className="qbd-btn-primary qbd-btn-large"
          onClick={handleGenerateCustom}
          disabled={loading || !customContent.trim()}
        >
          {loading ? <Loader className="qbd-spin" size={18} /> : <Sparkles size={18} />}
          <span>{loading ? 'Generating...' : 'Generate Questions'}</span>
        </button>
      </div>
    </div>
  );

  const renderQuestionSets = () => (
    <div className="qbd-view">
      <div className="qbd-view-header">
        <div className="qbd-view-title-group">
          <FileText className="qbd-view-icon" size={32} />
          <div>
            <h2 className="qbd-view-title">All Question Sets</h2>
            <p className="qbd-view-subtitle">Your generated question collections ready for practice</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="qbd-loading">
          <Loader className="qbd-spin" size={48} />
          <p>Loading question sets...</p>
        </div>
      ) : questionSets.length === 0 ? (
        <div className="qbd-empty-state">
          <FileText size={64} />
          <h3>No Question Sets Yet</h3>
          <p>Generate your first question set to get started</p>
          <button className="qbd-btn-primary" onClick={() => setActiveView('upload-pdf')}>
            <Plus size={18} />
            Create Question Set
          </button>
        </div>
      ) : (
        <div className="qbd-sets-grid">
          {questionSets.map(set => (
            <div key={set.id} className="qbd-set-card">
              <div className="qbd-set-header">
                <div className="qbd-set-icon">
                  <FileText size={28} />
                </div>
                <button 
                  className="qbd-set-delete"
                  onClick={() => deleteQuestionSet(set.id)}
                  title="Delete question set"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="qbd-set-content">
                <h3>{set.title}</h3>
                <p>{set.description}</p>
                
                <div className="qbd-set-stats">
                  <div className="qbd-stat-item">
                    <FileText size={16} />
                    <span>{set.total_questions} questions</span>
                  </div>
                  <div className="qbd-stat-item">
                    <Target size={16} />
                    <span>Best: {set.best_score}%</span>
                  </div>
                  <div className="qbd-stat-item">
                    <TrendingUp size={16} />
                    <span>{set.attempts} attempts</span>
                  </div>
                </div>

                <div className="qbd-set-meta">
                  <span className="qbd-source-badge">{set.source_type}</span>
                  <span className="qbd-date-badge">
                    {new Date(set.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <button 
                className="qbd-set-study-btn"
                onClick={() => startStudySession(set.id)}
              >
                <Play size={18} />
                <span>Start Practice</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderAnalytics = () => (
    <div className="qbd-view">
      <div className="qbd-view-header">
        <div className="qbd-view-title-group">
          <BarChart3 className="qbd-view-icon" size={32} />
          <div>
            <h2 className="qbd-view-title">Performance Analytics</h2>
            <p className="qbd-view-subtitle">Track your progress and identify areas for improvement</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="qbd-loading">
          <Loader className="qbd-spin" size={48} />
          <p>Loading analytics...</p>
        </div>
      ) : !analytics ? (
        <div className="qbd-empty-state">
          <PieChart size={64} />
          <h3>No Data Yet</h3>
          <p>Complete some question sets to see your analytics</p>
        </div>
      ) : (
        <div className="qbd-analytics-grid">
          <div className="qbd-stats-overview">
            <div className="qbd-stat-box">
              <div className="qbd-stat-icon success">
                <Award size={24} />
              </div>
              <div className="qbd-stat-data">
                <span className="qbd-stat-value">{analytics.total_sessions}</span>
                <span className="qbd-stat-label">Total Sessions</span>
              </div>
            </div>

            <div className="qbd-stat-box">
              <div className="qbd-stat-icon primary">
                <Target size={24} />
              </div>
              <div className="qbd-stat-data">
                <span className="qbd-stat-value">{analytics.average_score}%</span>
                <span className="qbd-stat-label">Average Score</span>
              </div>
            </div>

            <div className="qbd-stat-box">
              <div className="qbd-stat-icon accent">
                <Brain size={24} />
              </div>
              <div className="qbd-stat-data">
                <span className="qbd-stat-value">{analytics.total_questions_answered}</span>
                <span className="qbd-stat-label">Questions Answered</span>
              </div>
            </div>

            <div className="qbd-stat-box">
              <div className="qbd-stat-icon warning">
                <TrendingUp size={24} />
              </div>
              <div className="qbd-stat-data">
                <span className="qbd-stat-value">{analytics.recent_scores[0] || 0}%</span>
                <span className="qbd-stat-label">Latest Score</span>
              </div>
            </div>
          </div>

          {analytics.adaptive_recommendation && (
            <div className="qbd-adaptive-box">
              <div className="qbd-adaptive-header">
                <Zap size={24} />
                <h3>AI Recommendation</h3>
              </div>
              <div className="qbd-adaptive-content">
                <p className="qbd-adaptive-rec">
                  Recommended Difficulty: <strong>{analytics.adaptive_recommendation.recommended_difficulty}</strong>
                </p>
                <p className="qbd-adaptive-reason">{analytics.adaptive_recommendation.reason}</p>
                <div className="qbd-adaptive-dist">
                  <span>Suggested Mix:</span>
                  <span>Easy: {analytics.adaptive_recommendation.suggested_distribution.easy}</span>
                  <span>Medium: {analytics.adaptive_recommendation.suggested_distribution.medium}</span>
                  <span>Hard: {analytics.adaptive_recommendation.suggested_distribution.hard}</span>
                </div>
              </div>
            </div>
          )}

          <div className="qbd-performance-section">
            <h3 className="qbd-section-title">
              <TrendingUp size={20} />
              Topic Performance
            </h3>
            <div className="qbd-performance-list">
              {analytics.topic_performance?.map((topic, idx) => (
                <div key={idx} className="qbd-performance-item">
                  <div className="qbd-performance-info">
                    <span className="qbd-performance-topic">{topic.topic}</span>
                    <span className="qbd-performance-stats">
                      {topic.correct_answers}/{topic.total_questions} correct
                    </span>
                  </div>
                  <div className="qbd-performance-bar">
                    <div 
                      className="qbd-performance-fill"
                      style={{ 
                        width: `${topic.accuracy}%`,
                        backgroundColor: topic.accuracy >= 80 ? 'var(--success)' : topic.accuracy >= 60 ? 'var(--warning)' : 'var(--danger)'
                      }}
                    />
                  </div>
                  <span className="qbd-performance-accuracy">{topic.accuracy}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="qbd-difficulty-section">
            <h3 className="qbd-section-title">
              <Target size={20} />
              Difficulty Breakdown
            </h3>
            <div className="qbd-difficulty-grid">
              {analytics.difficulty_performance?.map((diff, idx) => (
                <div key={idx} className="qbd-difficulty-card">
                  <div className={`qbd-difficulty-badge ${diff.difficulty}`}>
                    {diff.difficulty}
                  </div>
                  <div className="qbd-difficulty-stats">
                    <span className="qbd-difficulty-accuracy">{diff.accuracy}%</span>
                    <span className="qbd-difficulty-count">
                      {diff.correct_answers}/{diff.total_questions}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {analytics.weak_topics && analytics.weak_topics.length > 0 && (
            <div className="qbd-weak-topics">
              <h3 className="qbd-section-title">
                <Target size={20} />
                Focus Areas
              </h3>
              <div className="qbd-topics-list">
                {analytics.weak_topics.map((topic, idx) => (
                  <div key={idx} className="qbd-weak-topic-card">
                    <span className="qbd-weak-topic-name">{topic.topic}</span>
                    <span className="qbd-weak-topic-accuracy">{topic.accuracy}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderStudyModal = () => {
    if (!showStudyModal || !selectedQuestionSet) return null;

    return (
      <div className="qbd-modal-overlay">
        <div className="qbd-modal" onClick={e => e.stopPropagation()}>
          <div className="qbd-modal-header">
            <h3>{selectedQuestionSet.title}</h3>
            <button className="qbd-modal-close" onClick={() => setShowStudyModal(false)}>×</button>
          </div>

          <div className="qbd-modal-content">
            {!showResults ? (
              <>
                <div className="qbd-progress-bar-container">
                  <span className="qbd-progress-text">
                    Question {currentQuestion + 1} of {selectedQuestionSet.questions.length}
                  </span>
                  <div className="qbd-progress-bar">
                    <div 
                      className="qbd-progress-fill"
                      style={{ width: `${((currentQuestion + 1) / selectedQuestionSet.questions.length) * 100}%` }}
                    />
                  </div>
                </div>

                {selectedQuestionSet.questions.map((q, idx) => (
                  <div 
                    key={q.id}
                    style={{ display: idx === currentQuestion ? 'block' : 'none' }}
                  >
                    <div className="qbd-question-header">
                      <span className={`qbd-difficulty-badge ${q.difficulty}`}>{q.difficulty}</span>
                      <span className="qbd-topic-badge">{q.topic}</span>
                    </div>

                    <p className="qbd-question-text">{q.question_text}</p>

                    {q.question_type === 'multiple_choice' && (
                      <div className="qbd-options">
                        {q.options.map((option, optIdx) => (
                          <label key={optIdx} className="qbd-option">
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
                      <div className="qbd-options">
                        <label className="qbd-option">
                          <input
                            type="radio"
                            name={`question-${q.id}`}
                            value="true"
                            checked={userAnswers[q.id] === 'true'}
                            onChange={() => handleAnswerChange(q.id, 'true')}
                          />
                          <span>True</span>
                        </label>
                        <label className="qbd-option">
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
                        className="qbd-textarea"
                        value={userAnswers[q.id] || ''}
                        onChange={e => handleAnswerChange(q.id, e.target.value)}
                        placeholder="Type your answer here..."
                        rows={4}
                      />
                    )}
                  </div>
                ))}

                <div className="qbd-navigation-btns">
                  <button 
                    className="qbd-btn-secondary"
                    onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                    disabled={currentQuestion === 0}
                  >
                    Previous
                  </button>
                  {currentQuestion < selectedQuestionSet.questions.length - 1 ? (
                    <button 
                      className="qbd-btn-primary"
                      onClick={() => setCurrentQuestion(currentQuestion + 1)}
                    >
                      Next
                    </button>
                  ) : (
                    <button 
                      className="qbd-btn-primary"
                      onClick={submitAnswers}
                      disabled={loading}
                    >
                      {loading ? 'Submitting...' : 'Submit Answers'}
                    </button>
                  )}
                </div>
              </>
            ) : results && (
              <div className="qbd-results">
                <div className="qbd-results-header">
                  <div className="qbd-score-circle">
                    <span className="qbd-score-value">{results.score}%</span>
                    <span className="qbd-score-label">Score</span>
                  </div>
                  <div className="qbd-results-stats">
                    <div className="qbd-result-stat correct">
                      <CheckCircle size={24} />
                      <span>{results.correct_count} Correct</span>
                    </div>
                    <div className="qbd-result-stat incorrect">
                      <XCircle size={24} />
                      <span>{results.total_questions - results.correct_count} Incorrect</span>
                    </div>
                  </div>
                </div>

                {results.adaptation && (
                  <div className="qbd-adaptation-box">
                    <h4>AI Recommendation</h4>
                    <p><strong>Next Difficulty:</strong> {results.adaptation.recommended_difficulty}</p>
                    <p>{results.adaptation.reason}</p>
                    <div className="qbd-suggested-distribution">
                      <span>Suggested Mix:</span>
                      <span>Easy: {results.adaptation.suggested_distribution.easy}</span>
                      <span>Medium: {results.adaptation.suggested_distribution.medium}</span>
                      <span>Hard: {results.adaptation.suggested_distribution.hard}</span>
                    </div>
                  </div>
                )}

                <div className="qbd-results-details">
                  <h4>Review Your Answers</h4>
                  {results.details.map((detail, idx) => (
                    <div key={idx} className={`qbd-result-item ${detail.is_correct ? 'correct' : 'incorrect'}`}>
                      <div className="qbd-result-indicator">
                        {detail.is_correct ? <CheckCircle size={20} /> : <XCircle size={20} />}
                      </div>
                      <div className="qbd-result-content">
                        <p className="qbd-result-question"><strong>Q{idx + 1}:</strong> {detail.question_text}</p>
                        <p className="qbd-result-answer">
                          <strong>Your answer:</strong> {detail.user_answer || 'No answer'}
                        </p>
                        {!detail.is_correct && (
                          <p className="qbd-result-correct">
                            <strong>Correct answer:</strong> {detail.correct_answer}
                          </p>
                        )}
                        {detail.explanation && (
                          <p className="qbd-result-explanation">{detail.explanation}</p>
                        )}
                        {!detail.is_correct && detail.question_id && (
                          <button 
                            className="qbd-btn-secondary qbd-btn-small"
                            onClick={() => generateSimilarQuestion(detail.question_id)}
                            disabled={loading}
                            style={{ marginTop: '10px' }}
                          >
                            <Zap size={16} style={{ marginRight: '5px' }} />
                            {loading ? 'Generating...' : 'Generate Similar Question'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  className="qbd-btn-primary qbd-btn-large"
                  onClick={() => {
                    setShowStudyModal(false);
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
    );
  };

  return (
    <div className="qbd-container">
      {renderSidebar()}
      <div className="qbd-main">
        {activeView === 'upload-pdf' && renderUploadPDF()}
        {activeView === 'chat-slides' && renderChatSlides()}
        {activeView === 'custom' && renderCustom()}
        {activeView === 'question-sets' && renderQuestionSets()}
        {activeView === 'analytics' && renderAnalytics()}
      </div>
      {renderStudyModal()}
    </div>
  );
};

export default QuestionBankDashboard;