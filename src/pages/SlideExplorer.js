import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Loader, FileText, Trash2, Eye, Sparkles, ChevronLeft, ChevronRight, BookOpen, Tag, Lightbulb, X } from 'lucide-react';
import './SlideExplorer.css';
import { API_URL } from '../config';

const SlideExplorer = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('user_id') || localStorage.getItem('username');

  // State
  const [uploadedSlides, setUploadedSlides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlide, setSelectedSlide] = useState(null);
  const [analyzedSlides, setAnalyzedSlides] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [imageErrors, setImageErrors] = useState({});

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

  // View slides without AI analysis (just show images)
  const viewSlide = (slideId) => {
    const slide = uploadedSlides.find(s => s.id === slideId);
    if (!slide) {
      alert('Slide not found');
      return;
    }
    
    setSelectedSlide(slide);
    setImageErrors({});
    
    // Create basic slide data without AI analysis
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

  // Analyze slides with AI-generated insights
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

  const closeViewer = () => {
    setSelectedSlide(null);
    setAnalyzedSlides([]);
    setCurrentSlideIndex(0);
    setImageErrors({});
  };

  const currentSlide = analyzedSlides[currentSlideIndex];


  return (
    <div className="se-page">
      {/* Header */}
      <header className="se-header">
        <div className="se-header-left">
          <button className="se-back-btn" onClick={() => navigate('/learning-review')}>
            ◄ Back
          </button>
          <div className="se-header-title-group">
            <h1 className="se-logo">cerbyl</h1>
            <span className="se-subtitle">SLIDE EXPLORER</span>
          </div>
        </div>
        <div className="se-header-right">
          <button className="se-nav-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
          <button className="se-nav-btn logout" onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}>Logout</button>
        </div>
      </header>

      {/* Main Content */}
      <div className="se-content">
        {/* Upload Section */}
        <div className="se-upload-section">
          <div className="se-section-header">
            <h2 className="se-section-title">Upload Presentations</h2>
            <p className="se-section-subtitle">Upload PDF or PowerPoint files to explore and analyze with AI</p>
          </div>

          <div
            className={`se-upload-area ${dragActive ? 'active' : ''} ${uploading ? 'disabled' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => !uploading && document.getElementById('se-file-input').click()}
          >
            <div className="se-upload-icon">
              {uploading ? <Loader size={32} className="se-spinner" /> : <Upload size={32} />}
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

        {/* Slides Grid */}
        <div className="se-slides-section">
          <div className="se-section-header">
            <h2 className="se-section-title">Your Presentations</h2>
            <p className="se-section-subtitle">
              {uploadedSlides.length} presentation{uploadedSlides.length !== 1 ? 's' : ''} uploaded
            </p>
          </div>

          {loading && uploadedSlides.length === 0 ? (
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
                  <div className="se-card-header">
                    <div className="se-card-icon">
                      <FileText size={24} />
                    </div>
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
                      className="se-action-btn se-action-view"
                      onClick={() => viewSlide(slide.id)}
                    >
                      <Eye size={16} />
                      <span>View</span>
                    </button>
                    <button 
                      className="se-action-btn se-action-insight"
                      onClick={() => analyzeSlide(slide.id)}
                      disabled={analyzing}
                    >
                      <Sparkles size={16} />
                      <span>{analyzing && selectedSlide?.id === slide.id ? 'Analyzing...' : 'Insights'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>


        {/* Enhanced Slide Viewer with AI Analysis */}
        {selectedSlide && analyzedSlides.length > 0 && (
          <div className="se-viewer-section">
            <div className="se-section-header">
              <div className="se-viewer-header-content">
                <div>
                  <h2 className="se-section-title">Analyzing: {selectedSlide.filename}</h2>
                  <p className="se-section-subtitle">
                    Slide {currentSlideIndex + 1} of {analyzedSlides.length}
                  </p>
                </div>
                <button className="se-close-viewer" onClick={closeViewer}>
                  <X size={16} />
                  Close
                </button>
              </div>
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

            {/* Current Slide Display */}
            {currentSlide && (
              <div className="se-slide-display">
                {/* Slide Preview */}
                <div className="se-slide-preview">
                  <div className="se-slide-image-container">
                    {!imageErrors[currentSlide.slide_number] ? (
                      <img 
                        src={`${API_URL}/slide_image/${selectedSlide.id}/${currentSlide.slide_number}`}
                        alt={`Slide ${currentSlide.slide_number}`}
                        className="se-slide-image"
                        onError={() => handleImageError(currentSlide.slide_number)}
                      />
                    ) : (
                      <div className="se-slide-placeholder">
                        <FileText size={48} />
                        <span className="se-slide-number-large">{currentSlide.slide_number}</span>
                        <span className="se-slide-title-display">{currentSlide.title}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Analysis Section */}
                <div className="se-analysis-section">
                  {/* Slide Title */}
                  <div className="se-analysis-header">
                    <h3 className="se-slide-title">{currentSlide.title || `Slide ${currentSlide.slide_number}`}</h3>
                    {!currentSlide.explanation && (
                      <button 
                        className="se-generate-insights-btn"
                        onClick={() => analyzeSlide(selectedSlide.id)}
                        disabled={analyzing}
                      >
                        <Sparkles size={16} />
                        {analyzing ? 'Generating...' : 'Generate AI Insights'}
                      </button>
                    )}
                  </div>

                  {/* Explanation */}
                  {currentSlide.explanation ? (
                    <div className="se-analysis-block">
                      <div className="se-analysis-label">
                        <BookOpen size={16} />
                        <span>Explanation</span>
                      </div>
                      <p className="se-explanation-text">
                        {currentSlide.explanation}
                      </p>
                    </div>
                  ) : (
                    <div className="se-no-insights">
                      <Sparkles size={32} />
                      <p>Click "Generate AI Insights" to get explanations, key points, and keywords for this slide.</p>
                    </div>
                  )}

                  {/* Key Points */}
                  {currentSlide.key_points && currentSlide.key_points.length > 0 && (
                    <div className="se-analysis-block">
                      <div className="se-analysis-label">
                        <Lightbulb size={16} />
                        <span>Key Points</span>
                      </div>
                      <ul className="se-key-points">
                        {currentSlide.key_points.map((point, idx) => (
                          <li key={idx} className="se-key-point">{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Keywords */}
                  {currentSlide.keywords && currentSlide.keywords.length > 0 && (
                    <div className="se-analysis-block">
                      <div className="se-analysis-label">
                        <Tag size={16} />
                        <span>Keywords</span>
                      </div>
                      <div className="se-keywords">
                        {currentSlide.keywords.map((keyword, idx) => (
                          <span key={idx} className="se-keyword-tag">{keyword}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Original Content (Collapsible) */}
                  {currentSlide.content && currentSlide.content.trim() && (
                    <details className="se-content-details">
                      <summary className="se-content-summary">
                        <Eye size={16} />
                        <span>View Original Content</span>
                      </summary>
                      <div className="se-original-content">
                        <pre>{currentSlide.content}</pre>
                      </div>
                    </details>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading State for Analysis */}
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
    </div>
  );
};

export default SlideExplorer;
