import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Loader, FileText, Trash2, Eye, Sparkles } from 'lucide-react';
import './SlideExplorer.css';

const SlideExplorer = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('user_id') || localStorage.getItem('username');

  // State
  const [uploadedSlides, setUploadedSlides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlide, setSelectedSlide] = useState(null);
  const [slideContent, setSlideContent] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchUploadedSlides();
  }, []);

  const fetchUploadedSlides = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8001/get_uploaded_slides?user_id=${userId}`, {
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
      handleUpload(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUpload(e.target.files);
    }
  };

  const handleUpload = async (files) => {
    // Validate files
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
      
      // Append user_id as form field
      formData.append('user_id', userId);
      
      // Append all files
      validFiles.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch('http://localhost:8001/upload_slides', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`
          // Don't set Content-Type, browser will set it with boundary for FormData
        },
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

  const viewSlide = async (slideId) => {
    try {
      setLoading(true);
      
      // Find the slide in our list
      const slide = uploadedSlides.find(s => s.id === slideId);
      if (!slide) {
        alert('Slide not found');
        return;
      }

      // For now, we'll show basic info since the backend doesn't have get_slide_content endpoint
      // You can add this endpoint or extract text on upload
      setSelectedSlide({
        id: slide.id,
        filename: slide.filename,
        page_count: slide.page_count || 0
      });
      
      // Generate placeholder content based on page count
      const placeholderContent = [];
      for (let i = 1; i <= (slide.page_count || 1); i++) {
        placeholderContent.push({
          page: i,
          text: `Content from page ${i} - Text extraction available after processing`
        });
      }
      setSlideContent(placeholderContent);
      
    } catch (error) {
      console.error('Error viewing slide:', error);
      alert('Error loading slide content');
    } finally {
      setLoading(false);
    }
  };

  const deleteSlide = async (slideId) => {
    if (!window.confirm('Delete this slide presentation?')) return;

    try {
      const response = await fetch(`http://localhost:8001/delete_slide/${slideId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        await fetchUploadedSlides();
        // Clear selected slide if it was deleted
        if (selectedSlide && selectedSlide.id === slideId) {
          setSelectedSlide(null);
          setSlideContent([]);
        }
      } else {
        alert('Failed to delete slide');
      }
    } catch (error) {
      console.error('Error deleting slide:', error);
      alert('Error deleting slide');
    }
  };

  const generateInsight = async (slideId) => {
    alert('AI insights generation will be available soon! This will analyze your slides and provide key takeaways.');
    // This endpoint doesn't exist in main.py yet, but we can implement it later
  };

  return (
    <div className="se-page">
      {/* Header */}
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

      {/* Main Content */}
      <div className="se-content">
        {/* Upload Section */}
        <div className="se-upload-section">
          <div className="se-section-header">
            <h2 className="se-section-title">Upload Presentations</h2>
            <p className="se-section-subtitle">Upload PDF or PowerPoint files to explore and analyze</p>
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
                      onClick={() => generateInsight(slide.id)}
                    >
                      <Sparkles size={16} />
                      <span>Insights</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Slide Viewer */}
        {selectedSlide && slideContent.length > 0 && (
          <div className="se-viewer-section">
            <div className="se-section-header">
              <div className="se-viewer-header-content">
                <div>
                  <h2 className="se-section-title">Viewing: {selectedSlide.filename}</h2>
                  <p className="se-section-subtitle">{slideContent.length} page{slideContent.length !== 1 ? 's' : ''}</p>
                </div>
                <button 
                  className="se-close-viewer"
                  onClick={() => { setSelectedSlide(null); setSlideContent([]); }}
                >
                  Close Viewer
                </button>
              </div>
            </div>

            <div className="se-slides-viewer">
              {slideContent.map((content, idx) => (
                <div key={idx} className="se-slide-item">
                  <div className="se-slide-number">{content.page || idx + 1}</div>
                  <div className="se-slide-content">
                    <p className="se-slide-text">
                      {content.text || content.content || 'No text content available'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SlideExplorer;