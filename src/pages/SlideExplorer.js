import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Loader, FileText, Trash2 } from 'lucide-react';
import './SlideExplorer.css';

const SlideExplorer = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [userName, setUserName] = useState('');

  // State
  const [uploadedSlides, setUploadedSlides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlide, setSelectedSlide] = useState(null);
  const [slideContent, setSlideContent] = useState([]);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    fetchUserProfile();
    fetchUploadedSlides();
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch('http://localhost:8001/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUserName(data.first_name || 'User');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchUploadedSlides = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8001/get_uploaded_slides', {
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
  };

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
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0]);
    }
  };

  const handleUpload = async (file) => {
    if (!file.name.match(/\.(pdf|pptx|ppt)$/i)) {
      alert('Please upload a PDF or PowerPoint file');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:8001/upload_slides', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        await fetchUploadedSlides();
      } else {
        alert('Failed to upload slides');
      }
    } catch (error) {
      console.error('Error uploading slides:', error);
      alert('Error uploading slides');
    } finally {
      setLoading(false);
    }
  };

  const viewSlide = async (slideId) => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8001/get_slide_content/${slideId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedSlide(data);
        setSlideContent(data.slides || []);
      }
    } catch (error) {
      console.error('Error fetching slide content:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteSlide = async (slideId) => {
    if (!window.confirm('Delete this slide presentation?')) return;

    try {
      const response = await fetch(`http://localhost:8001/delete_slides/${slideId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        await fetchUploadedSlides();
        setSelectedSlide(null);
        setSlideContent([]);
      }
    } catch (error) {
      console.error('Error deleting slide:', error);
    }
  };

  const generateInsight = async (slideId) => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8001/generate_slide_summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ slide_id: slideId })
      });

      if (response.ok) {
        const data = await response.json();
        alert('Insight: ' + (data.summary || data.insight || 'Generated successfully'));
      }
    } catch (error) {
      console.error('Error generating insight:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="se-page">
      <header className="se-header">
        <div className="se-header-left">
          <button className="se-back-btn" onClick={() => navigate('/learning-review')}>
            <ArrowLeft size={20} />
            <span>BACK</span>
          </button>
          <div className="se-header-title-group">
            <h1 className="se-logo">brainwave</h1>
            <span className="se-subtitle">SLIDE EXPLORER</span>
          </div>
        </div>
        <div className="se-header-right">
          <button className="se-nav-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
          <button className="se-nav-btn logout" onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}>Logout</button>
        </div>
      </header>

      <div className="se-content">
        <div className="se-main">
          {/* UPLOAD SECTION */}
          <div className="se-upload-section">
            <div className="se-section-header">
              <h2 className="se-section-title">Upload Presentations</h2>
              <p className="se-section-subtitle">Upload PDF or PowerPoint files to explore and analyze</p>
            </div>

            <div
              className={`se-upload-area ${dragActive ? 'active' : ''} ${loading ? 'disabled' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="se-upload-icon">
                <Upload size={32} />
              </div>
              <p className="se-upload-title">Drag files here or click to upload</p>
              <p className="se-upload-subtitle">Supports PDF and PowerPoint (.pptx, .ppt)</p>
              <input
                type="file"
                id="file-input"
                accept=".pdf,.pptx,.ppt"
                onChange={handleFileSelect}
                disabled={loading}
                className="se-file-input"
              />
            </div>
          </div>

          {/* SLIDES GRID */}
          <div className="se-slides-section">
            <div className="se-section-header">
              <h2 className="se-section-title">Your Presentations</h2>
              <p className="se-section-subtitle">{uploadedSlides.length} presentation{uploadedSlides.length !== 1 ? 's' : ''} uploaded</p>
            </div>

            {loading && uploadedSlides.length === 0 ? (
              <div className="se-loading">
                <Loader size={40} className="se-spinner" />
                <p>Loading slides...</p>
              </div>
            ) : uploadedSlides.length === 0 ? (
              <div className="se-empty">
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
                        <p className="se-meta-item">Slides: {slide.slide_count || 0}</p>
                        <p className="se-meta-item">Uploaded: {new Date(slide.uploaded_at).toLocaleDateString()}</p>
                      </div>
                    </div>

                    <div className="se-card-actions">
                      <button 
                        className="se-action-btn se-action-view"
                        onClick={() => viewSlide(slide.id)}
                      >
                        View
                      </button>
                      <button 
                        className="se-action-btn se-action-insight"
                        onClick={() => generateInsight(slide.id)}
                      >
                        Analyze
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SLIDE VIEWER */}
          {selectedSlide && slideContent.length > 0 && (
            <div className="se-viewer-section">
              <div className="se-section-header">
                <h2 className="se-section-title">Viewing: {selectedSlide.filename}</h2>
                <p className="se-section-subtitle">{slideContent.length} slides</p>
              </div>

              <div className="se-slides-viewer">
                {slideContent.map((content, idx) => (
                  <div key={idx} className="se-slide-item">
                    <div className="se-slide-number">{idx + 1}</div>
                    <div className="se-slide-content">
                      <p className="se-slide-text">{content.text || content.content || 'No text content'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SlideExplorer;