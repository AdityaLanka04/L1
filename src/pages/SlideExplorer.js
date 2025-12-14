import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Loader, FileText, Trash2, Eye, Sparkles, ChevronLeft, ChevronRight, BookOpen, Tag, Lightbulb, X, UploadCloud, Presentation } from 'lucide-react';
import './SlideExplorer.css';
import { API_URL } from '../config';

const SlideExplorer = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('user_id') || localStorage.getItem('username');

  // State
  const [activeTab, setActiveTab] = useState('viewer'); // 'viewer' or 'myslides'
  const [uploadedSlides, setUploadedSlides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlide, setSelectedSlide] = useState(null);
  const [analyzedSlides, setAnalyzedSlides] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [imageErrors, setImageErrors] = useState({});
  const [showUpload, setShowUpload] = useState(true); // Show upload by default

  const fetchUploadedSlides = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/get_uploaded_slides?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUploadedSlides(data.slides || []);
      }
    } catch (error) {
      console.error('Error fetching slides:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, token]);

  useEffect(() => {
    fetchUploadedSlides();
  }, [fetchUploadedSlides]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUpload(e.target.files);
    }
  };

  const handleUpload = async (files) => {
    const validFiles = Array.from(files).filter(file => 
      file.name.match(/\.(pdf|pptx|ppt)$/i)
    );

    if (validFiles.length === 0) {
      alert('Please upload PDF or PowerPoint files only');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('user_id', userId);
      validFiles.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch(`${API_URL}/upload_slides`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Successfully uploaded ${data.uploaded_count} file(s)`);
        await fetchUploadedSlides();
      } else {
        const errorData = await response.json();
        alert(`Failed to upload: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error uploading slides:', error);
      alert('Error uploading slides');
    } finally {
      setUploading(false);
    }
  };

  const viewSlide = (slideId) => {
    const slide = uploadedSlides.find(s => s.id === slideId);
    if (!slide) {
      alert('Slide not found');
      return;
    }
    
    setSelectedSlide(slide);
    setImageErrors({});
    setShowUpload(false); // Hide upload when viewing
    setActiveTab('viewer'); // Switch to viewer tab
    
    const basicSlides = [];
    for (let i = 1; i <= (slide.page_count || 1); i++) {
      basicSlides.push({
        slide_number: i,
        title: `Slide ${i}`,
        content: '',
        explanation: '',
        key_points: [],
        keywords: []
      });
    }
    setAnalyzedSlides(basicSlides);
    setCurrentSlideIndex(0);
  };

  const analyzeSlide = async (slideId) => {
    try {
      setAnalyzing(true);
      setImageErrors({});
      
      const slide = uploadedSlides.find(s => s.id === slideId);
      if (!slide) {
        alert('Slide not found');
        setAnalyzing(false);
        return;
      }

      setSelectedSlide(slide);
      setShowUpload(false);
      setActiveTab('viewer');

      const response = await fetch(`${API_URL}/analyze_slide/${slideId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.slides && data.slides.length > 0) {
          setAnalyzedSlides(data.slides);
          setCurrentSlideIndex(0);
        } else {
          alert('No slides found in the presentation');
        }
      } else {
        const errorData = await response.json();
        alert(`Failed to analyze: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error analyzing slide:', error);
      alert('Error analyzing slides. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const deleteSlide = async (slideId) => {
    if (!window.confirm('Delete this slide presentation?')) return;

    try {
      const response = await fetch(`${API_URL}/delete_slide/${slideId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        await fetchUploadedSlides();
        if (selectedSlide && selectedSlide.id === slideId) {
          setSelectedSlide(null);
          setAnalyzedSlides([]);
          setShowUpload(true);
        }
      } else {
        alert('Failed to delete slide');
      }
    } catch (error) {
      console.error('Error deleting slide:', error);
      alert('Error deleting slide');
    }
  };

  const goToSlide = (index) => {
    if (index >= 0 && index < analyzedSlides.length) {
      setCurrentSlideIndex(index);
    }
  };

  const handleImageError = (slideNumber) => {
    setImageErrors(prev => ({ ...prev, [slideNumber]: true }));
  };

  const handleUploadNew = () => {
    setShowUpload(true);
    setSelectedSlide(null);
    setAnalyzedSlides([]);
    setCurrentSlideIndex(0);
  };

  const currentSlide = analyzedSlides[currentSlideIndex];

  return (
    <div className="se-page">
      {/* Header */}
      <header className="se-header">
        <div className="se-header-left">
          <div className="se-header-title-group">
            <h1 className="se-logo">cerbyl</h1>
            <span className="se-subtitle">SLIDE EXPLORER</span>
          </div>
        </div>
        <div className="se-header-right">
          <button className="se-back-btn" onClick={() => navigate('/learning-review')}>
            <ChevronLeft size={18} />
            <span>Back</span>
          </button>
          <button className="se-nav-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
          <button className="se-nav-btn logout" onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}>Logout</button>
        </div>
      </header>

      {/* Main Layout with Sidebar */}
      <div className="se-main-layout">
        {/* Sidebar */}
        <aside className="se-sidebar">
          <button 
            className={`se-tab-btn ${activeTab === 'viewer' ? 'active' : ''}`}
            onClick={() => setActiveTab('viewer')}
          >
            <Eye size={20} />
            <span>View/Upload</span>
          </button>
          <button 
            className={`se-tab-btn ${activeTab === 'myslides' ? 'active' : ''}`}
            onClick={() => setActiveTab('myslides')}
          >
            <Presentation size={20} />
            <span>My Slides</span>
          </button>
        </aside>

        {/* Main Content */}
        <main className="se-main-content">
          {/* View/Upload Tab */}
          {activeTab === 'viewer' && (
            <div className="se-viewer-tab">
              {showUpload && !selectedSlide ? (
                // Upload Area
                <div className="se-upload-container">
                  <h2 className="se-content-title">Upload Presentation</h2>
                  <p className="se-content-subtitle">Upload PDF or PowerPoint files to explore and analyze with AI</p>
                  
                  <div
                    className={`se-upload-area ${dragActive ? 'active' : ''} ${uploading ? 'disabled' : ''}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => !uploading && document.getElementById('se-file-input').click()}
                  >
                    <div className="se-upload-icon">
                      {uploading ? <Loader size={48} className="se-spinner" /> : <UploadCloud size={48} />}
                    </div>
                    <p className="se-upload-title">
                      {uploading ? 'Uploading...' : 'Drag files here or click to upload'}
                    </p>
                    <p className="se-upload-subtitle">Supports PDF and PowerPoint (.pptx, .ppt)</p>
                    <input
                      type="file"
                      id="se-file-input"
                      accept=".pdf,.pptx,.ppt"
                      onChange={handleFileSelect}
                      disabled={uploading}
                      className="se-file-input"
                      multiple
                    />
                  </div>
                </div>
              ) : selectedSlide && analyzedSlides.length > 0 ? (
                // Slide Viewer
                <div className="se-viewer-container">
                  <div className="se-viewer-header">
                    <div>
                      <h2 className="se-content-title">{selectedSlide.filename}</h2>
                      <p className="se-content-subtitle">
                        Slide {currentSlideIndex + 1} of {analyzedSlides.length}
                      </p>
                    </div>
                    <button className="se-upload-new-btn" onClick={handleUploadNew}>
                      <Upload size={16} />
                      <span>Upload New</span>
                    </button>
                  </div>

                  {/* Slide Navigation */}
                  <div className="se-slide-nav">
                    <button 
                      className="se-nav-arrow"
                      onClick={() => goToSlide(currentSlideIndex - 1)}
                      disabled={currentSlideIndex === 0}
                    >
                      <ChevronLeft size={24} />
                    </button>
                    
                    <div className="se-slide-thumbnails">
                      {analyzedSlides.map((slide, idx) => (
                        <button
                          key={idx}
                          className={`se-thumbnail ${idx === currentSlideIndex ? 'active' : ''}`}
                          onClick={() => goToSlide(idx)}
                        >
                          {slide.slide_number}
                        </button>
                      ))}
                    </div>
                    
                    <button 
                      className="se-nav-arrow"
                      onClick={() => goToSlide(currentSlideIndex + 1)}
                      disabled={currentSlideIndex === analyzedSlides.length - 1}
                    >
                      <ChevronRight size={24} />
                    </button>
                  </div>

                  {/* Slide Display - Full Width on Top, Scrollable Content Below */}
                  {currentSlide && (
                    <div className="se-slide-display-vertical">
                      {/* Slide Image - Full Width */}
                      <div className="se-slide-preview-full">
                        <div className="se-slide-image-container-full">
                          {!imageErrors[currentSlide.slide_number] ? (
                            <img 
                              src={`${API_URL}/slide_image/${selectedSlide.id}/${currentSlide.slide_number}`}
                              alt={`Slide ${currentSlide.slide_number}`}
                              className="se-slide-image-full"
                              onError={() => handleImageError(currentSlide.slide_number)}
                            />
                          ) : (
                            <div className="se-slide-placeholder-full">
                              <FileText size={64} />
                              <span className="se-slide-number-large">{currentSlide.slide_number}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Comprehensive Analysis - Scrollable Below */}
                      <div className="se-comprehensive-analysis">
                        <div className="se-analysis-header-main">
                          <h2 className="se-slide-title-main">{currentSlide.title || `Slide ${currentSlide.slide_number}`}</h2>
                          {currentSlide.difficulty_level && (
                            <span className={`se-difficulty-badge se-difficulty-${currentSlide.difficulty_level}`}>
                              {currentSlide.difficulty_level}
                            </span>
                          )}
                          {currentSlide.estimated_study_time && (
                            <span className="se-study-time-badge">
                              ⏱️ {currentSlide.estimated_study_time}
                            </span>
                          )}
                        </div>

                        {currentSlide.detailed_explanation ? (
                          <>
                            {/* Detailed Explanation */}
                            <div className="se-analysis-section-main">
                              <div className="se-section-header">
                                <BookOpen size={20} />
                                <h3>Detailed Explanation</h3>
                              </div>
                              <div className="se-detailed-explanation">
                                {currentSlide.detailed_explanation.split('\n\n').map((para, idx) => (
                                  <p key={idx}>{para}</p>
                                ))}
                              </div>
                            </div>

                            {/* Key Concepts */}
                            {currentSlide.key_concepts && currentSlide.key_concepts.length > 0 && (
                              <div className="se-analysis-section-main">
                                <div className="se-section-header">
                                  <Lightbulb size={20} />
                                  <h3>Key Concepts</h3>
                                </div>
                                <ul className="se-key-concepts-list">
                                  {currentSlide.key_concepts.map((concept, idx) => (
                                    <li key={idx}>{concept}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Definitions */}
                            {currentSlide.definitions && Object.keys(currentSlide.definitions).length > 0 && (
                              <div className="se-analysis-section-main">
                                <div className="se-section-header">
                                  <Tag size={20} />
                                  <h3>Important Definitions</h3>
                                </div>
                                <div className="se-definitions-grid">
                                  {Object.entries(currentSlide.definitions).map(([term, definition], idx) => (
                                    <div key={idx} className="se-definition-card">
                                      <h4 className="se-definition-term">{term}</h4>
                                      <p className="se-definition-text">{definition}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Exam Questions */}
                            {currentSlide.exam_questions && currentSlide.exam_questions.length > 0 && (
                              <div className="se-analysis-section-main se-exam-section">
                                <div className="se-section-header">
                                  <FileText size={20} />
                                  <h3>Potential Exam Questions</h3>
                                </div>
                                <div className="se-exam-questions">
                                  {currentSlide.exam_questions.map((q, idx) => (
                                    <div key={idx} className="se-exam-question-card">
                                      <div className="se-question-header">
                                        <span className="se-question-number">Q{idx + 1}</span>
                                        <span className={`se-question-type ${q.type}`}>{q.type}</span>
                                        <span className={`se-question-difficulty ${q.difficulty}`}>{q.difficulty}</span>
                                      </div>
                                      <p className="se-question-text">{q.question}</p>
                                      {q.answer_hint && (
                                        <div className="se-answer-hint">
                                          <strong>Hint:</strong> {q.answer_hint}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Practical Applications */}
                            {currentSlide.practical_applications && currentSlide.practical_applications.length > 0 && (
                              <div className="se-analysis-section-main">
                                <div className="se-section-header">
                                  <Sparkles size={20} />
                                  <h3>Practical Applications</h3>
                                </div>
                                <ul className="se-applications-list">
                                  {currentSlide.practical_applications.map((app, idx) => (
                                    <li key={idx}>{app}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Common Misconceptions */}
                            {currentSlide.common_misconceptions && currentSlide.common_misconceptions.length > 0 && (
                              <div className="se-analysis-section-main se-misconceptions-section">
                                <div className="se-section-header">
                                  <X size={20} />
                                  <h3>Common Misconceptions</h3>
                                </div>
                                <ul className="se-misconceptions-list">
                                  {currentSlide.common_misconceptions.map((misc, idx) => (
                                    <li key={idx}>{misc}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Study Tips */}
                            {currentSlide.study_tips && currentSlide.study_tips.length > 0 && (
                              <div className="se-analysis-section-main se-study-tips-section">
                                <div className="se-section-header">
                                  <Lightbulb size={20} />
                                  <h3>Study Tips</h3>
                                </div>
                                <ul className="se-study-tips-list">
                                  {currentSlide.study_tips.map((tip, idx) => (
                                    <li key={idx}>{tip}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Cross References */}
                            {currentSlide.cross_references && currentSlide.cross_references.length > 0 && (
                              <div className="se-analysis-section-main">
                                <div className="se-section-header">
                                  <ChevronRight size={20} />
                                  <h3>Related Content</h3>
                                </div>
                                <div className="se-cross-references">
                                  {currentSlide.cross_references.map((ref, idx) => (
                                    <span key={idx} className="se-cross-ref-tag">{ref}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="se-no-insights">
                            <Loader size={48} className="se-spinner" />
                            <p>Loading comprehensive analysis...</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* My Slides Tab */}
          {activeTab === 'myslides' && (
            <div className="se-myslides-tab">
              <h2 className="se-content-title">My Presentations</h2>
              <p className="se-content-subtitle">
                {uploadedSlides.length} presentation{uploadedSlides.length !== 1 ? 's' : ''} uploaded
              </p>

              {loading ? (
                <div className="se-loading">
                  <Loader size={40} className="se-spinner" />
                  <p>Loading slides...</p>
                </div>
              ) : uploadedSlides.length === 0 ? (
                <div className="se-empty">
                  <FileText size={64} className="se-empty-icon" />
                  <p>No presentations uploaded yet. Upload one to get started!</p>
                </div>
              ) : (
                <div className="se-grid">
                  {uploadedSlides.map(slide => (
                    <div key={slide.id} className="se-card">
                      <div className="se-card-thumbnail">
                        {!imageErrors[`card-${slide.id}`] ? (
                          <img 
                            src={`${API_URL}/slide_image/${slide.id}/1`}
                            alt={`${slide.filename} preview`}
                            className="se-card-thumbnail-img"
                            onError={() => setImageErrors(prev => ({ ...prev, [`card-${slide.id}`]: true }))}
                          />
                        ) : (
                          <div className="se-card-thumbnail-placeholder">
                            <FileText size={48} />
                          </div>
                        )}
                        <button 
                          className="se-delete-btn"
                          onClick={() => deleteSlide(slide.id)}
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="se-card-content">
                        <h3 className="se-card-title">{slide.filename || 'Untitled'}</h3>
                        <div className="se-card-meta">
                          <div className="se-meta-item">
                            <span className="se-meta-label">Pages:</span>
                            <span className="se-meta-value">{slide.page_count || 0}</span>
                          </div>
                          <div className="se-meta-item">
                            <span className="se-meta-label">Size:</span>
                            <span className="se-meta-value">
                              {slide.file_size ? `${(slide.file_size / 1024 / 1024).toFixed(1)} MB` : 'N/A'}
                            </span>
                          </div>
                        </div>
                        <p className="se-card-date">
                          Uploaded: {new Date(slide.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="se-card-actions">
                        <button 
                          className="se-action-btn se-action-open"
                          onClick={() => analyzeSlide(slide.id)}
                          disabled={analyzing && selectedSlide?.id === slide.id}
                        >
                          <Sparkles size={16} />
                          <span>{analyzing && selectedSlide?.id === slide.id ? 'Opening...' : 'Open'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Analyzing Overlay */}
      {analyzing && (
        <div className="se-analyzing-overlay">
          <div className="se-analyzing-content">
            <Loader size={48} className="se-spinner" />
            <h3>Analyzing Presentation</h3>
            <p>Extracting content and generating AI insights...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlideExplorer;
