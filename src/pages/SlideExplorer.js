import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Loader, FileText, Trash2, ChevronLeft, ChevronRight, BookOpen, Tag, Lightbulb, UploadCloud, Menu, MessageSquare, Brain, Zap, Maximize2, Minimize2 } from 'lucide-react';
import './SlideExplorer.css';
import { API_URL } from '../config';
import slideExplorerAgentService from '../services/slideExplorerAgentService';

const CARD_COLORS = [
  '#e8a598', '#7ecdc8', '#f0c274', '#a8d8a8', '#c3a8d8',
  '#f4a67a', '#82c5d4', '#e8c5a0', '#a8c5e8', '#d4a8c5',
];

const renderMarkdown = (text) => {
  if (!text) return '';

  const lines = text.split('\n');
  const processedLines = [];
  let inBulletList = false;
  let inNumberedList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    if (/^#### (.+)$/.test(line)) {
      if (inBulletList) { processedLines.push('</ul>'); inBulletList = false; }
      if (inNumberedList) { processedLines.push('</ol>'); inNumberedList = false; }
      processedLines.push(`<h4 class="md-h4">${line.replace(/^#### (.+)$/, '$1')}</h4>`);
      continue;
    }
    if (/^### (.+)$/.test(line)) {
      if (inBulletList) { processedLines.push('</ul>'); inBulletList = false; }
      if (inNumberedList) { processedLines.push('</ol>'); inNumberedList = false; }
      processedLines.push(`<h3 class="md-h3">${line.replace(/^### (.+)$/, '$1')}</h3>`);
      continue;
    }
    if (/^## (.+)$/.test(line)) {
      if (inBulletList) { processedLines.push('</ul>'); inBulletList = false; }
      if (inNumberedList) { processedLines.push('</ol>'); inNumberedList = false; }
      processedLines.push(`<h2 class="md-h2">${line.replace(/^## (.+)$/, '$1')}</h2>`);
      continue;
    }
    if (/^# (.+)$/.test(line)) {
      if (inBulletList) { processedLines.push('</ul>'); inBulletList = false; }
      if (inNumberedList) { processedLines.push('</ol>'); inNumberedList = false; }
      processedLines.push(`<h1 class="md-h1">${line.replace(/^# (.+)$/, '$1')}</h1>`);
      continue;
    }

    line = line.replace(/\*\*(.+?)\*\*/g, '<strong class="md-bold-inline">$1</strong>');
    line = line.replace(/__(.+?)__/g, '<strong class="md-bold-inline">$1</strong>');
    line = line.replace(/(?<!\w)\*([^*]+?)\*(?!\w)/g, '<em>$1</em>');
    line = line.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

    const isBullet = /^[\*\-•] (.+)$/.test(line);
    const isNumbered = /^\d+\. (.+)$/.test(line);

    if (isBullet) {
      if (!inBulletList) { processedLines.push('<ul class="md-ul">'); inBulletList = true; }
      processedLines.push(`<li class="md-li">${line.replace(/^[\*\-•] (.+)$/, '$1')}</li>`);
    } else if (isNumbered) {
      if (!inNumberedList) { processedLines.push('<ol class="md-ol">'); inNumberedList = true; }
      processedLines.push(`<li class="md-li-num">${line.replace(/^\d+\. (.+)$/, '$1')}</li>`);
    } else {
      if (inBulletList) { processedLines.push('</ul>'); inBulletList = false; }
      if (inNumberedList) { processedLines.push('</ol>'); inNumberedList = false; }
      processedLines.push(line);
    }
  }
  if (inBulletList) processedLines.push('</ul>');
  if (inNumberedList) processedLines.push('</ol>');

  const finalContent = [];
  let currentParagraph = [];

  for (let i = 0; i < processedLines.length; i++) {
    const line = processedLines[i];
    const trimmedLine = line.trim();
    const isBlockElement = line.startsWith('<h') || line.startsWith('<ul') || line.startsWith('<ol') ||
      line.startsWith('</ul>') || line.startsWith('</ol>');
    const isEmptyLine = trimmedLine === '';

    if (isBlockElement) {
      if (currentParagraph.length > 0) { finalContent.push(`<p>${currentParagraph.join(' ')}</p>`); currentParagraph = []; }
      finalContent.push(line);
    } else if (isEmptyLine) {
      if (currentParagraph.length > 0) { finalContent.push(`<p>${currentParagraph.join(' ')}</p>`); currentParagraph = []; }
    } else {
      if (trimmedLine) currentParagraph.push(trimmedLine);
    }
  }
  if (currentParagraph.length > 0) finalContent.push(`<p>${currentParagraph.join(' ')}</p>`);

  return finalContent.join('\n');
};

const SlideExplorer = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('user_id') || localStorage.getItem('username');

  const [uploadedSlides, setUploadedSlides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlide, setSelectedSlide] = useState(null);
  const [analyzedSlides, setAnalyzedSlides] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeView, setActiveView] = useState('grid'); // 'grid' | 'upload'
  const [focusMode, setFocusMode] = useState(false);
  const [showInsights, setShowInsights] = useState({});

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
      // silenced
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
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files);
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) handleUpload(e.target.files);
  };

  const handleUpload = async (files) => {
    const validFiles = Array.from(files).filter(file => file.name.match(/\.(pdf|pptx|ppt)$/i));
    if (validFiles.length === 0) { alert('Please upload PDF or PowerPoint files only'); return; }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('user_id', userId);
      validFiles.forEach(file => formData.append('files', file));

      const response = await fetch(`${API_URL}/upload_slides`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        await response.json();
        setActiveView('grid');
        await fetchUploadedSlides();
      } else {
        const errorData = await response.json();
        alert(`Failed to upload: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      alert('Error uploading slides');
    } finally {
      setUploading(false);
    }
  };

  const analyzeSlide = async (slideId) => {
    try {
      setAnalyzing(true);

      const slide = uploadedSlides.find(s => s.id === slideId);
      if (!slide) { setAnalyzing(false); return; }

      setSelectedSlide(slide);
      setCurrentSlideIndex(0);
      setFocusMode(false);

      try {
        await slideExplorerAgentService.analyzeSlide({
          userId,
          slideContent: slide.extracted_text || slide.title,
          analysisDepth: 'standard',
          sessionId: `slide_analysis_${userId}_${Date.now()}`
        });
      } catch (agentError) {
        // silenced
      }

      const response = await fetch(`${API_URL}/analyze_slide/${slideId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.slides && data.slides.length > 0) {
          setAnalyzedSlides(data.slides);
        } else {
          alert('No slides found in the presentation');
          setSelectedSlide(null);
        }
      } else {
        const errorData = await response.json();
        alert(`Failed to analyze: ${errorData.detail || 'Unknown error'}`);
        setSelectedSlide(null);
      }
    } catch (error) {
      alert('Error analyzing slides. Please try again.');
      setSelectedSlide(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const deleteSlide = async (slideId, e) => {
    e && e.stopPropagation();
    if (!window.confirm('Delete this presentation?')) return;

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
        alert('Failed to delete');
      }
    } catch (error) {
      alert('Error deleting');
    }
  };

  const goToSlide = (index) => {
    if (index >= 0 && index < analyzedSlides.length) setCurrentSlideIndex(index);
  };

  const currentSlide = analyzedSlides[currentSlideIndex];

  // ─── ANALYSIS VIEW ────────────────────────────────────────────────
  if (selectedSlide && analyzedSlides.length > 0) {
    return (
      <div className={`se-page se-analysis-page ${focusMode ? 'se-focus-mode' : ''}`}>
        <header className="se-header">
          <div className="se-header-left">
            {!focusMode && (
              <button className="nav-menu-btn" onClick={() => window.openGlobalNav && window.openGlobalNav()} aria-label="Open navigation">
                <Menu size={20} />
              </button>
            )}
            <h1 className="se-header-title" onClick={() => navigate('/search-hub')}>
              <div className="se-logo-img" />
              cerbyl
            </h1>
            <div className="se-header-divider" />
            <p className="se-header-subtitle">SLIDE EXPLORER</p>
          </div>
          <div className="se-header-actions">
            <button className="se-focus-btn" onClick={() => setFocusMode(f => !f)} title={focusMode ? 'Exit Focus' : 'Focus Mode'}>
              {focusMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              <span>{focusMode ? 'Exit Focus' : 'Focus'}</span>
            </button>
            <button className="se-back-btn" onClick={() => { setSelectedSlide(null); setAnalyzedSlides([]); setFocusMode(false); }}>
              <ChevronLeft size={18} />
              <span>Back</span>
            </button>
          </div>
        </header>

        <div className="se-analysis-layout">
          {!focusMode && (
            <aside className="se-analysis-sidebar">
              <div className="se-analysis-sidebar-title">{selectedSlide.filename}</div>
              <div className="se-analysis-slide-list">
                {analyzedSlides.map((slide, idx) => (
                  <button
                    key={idx}
                    className={`se-analysis-slide-thumb ${idx === currentSlideIndex ? 'active' : ''}`}
                    onClick={() => goToSlide(idx)}
                  >
                    <div className="se-thumb-num">{idx + 1}</div>
                    <div className="se-thumb-title">{slide.title || `Slide ${slide.slide_number}`}</div>
                  </button>
                ))}
              </div>
            </aside>
          )}

          <main className="se-analysis-main">
            <div className="se-analysis-nav-bar">
              <button className="se-nav-arrow" onClick={() => goToSlide(currentSlideIndex - 1)} disabled={currentSlideIndex === 0}>
                <ChevronLeft size={20} />
              </button>
              <span className="se-slide-counter">Slide {currentSlideIndex + 1} of {analyzedSlides.length}</span>
              <button className="se-nav-arrow" onClick={() => goToSlide(currentSlideIndex + 1)} disabled={currentSlideIndex === analyzedSlides.length - 1}>
                <ChevronRight size={20} />
              </button>
            </div>

            {currentSlide && (
              <div className="se-slide-content-area">
                <div className="se-slide-image-panel">
                  <img
                    src={`${API_URL}/slide_image/${selectedSlide.id}/${currentSlide.slide_number}`}
                    alt={`Slide ${currentSlide.slide_number}`}
                    className="se-slide-img"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div className="se-slide-img-fallback" style={{ display: 'none' }}>
                    <FileText size={56} />
                    <span>Slide {currentSlide.slide_number}</span>
                  </div>
                </div>

                <div className="se-slide-explanation-panel">
                  <div className="se-explanation-header">
                    <h2 className="se-explanation-title">{currentSlide.title || `Slide ${currentSlide.slide_number}`}</h2>
                  </div>

                  {currentSlide.detailed_explanation ? (
                    <div className="se-explanation-body">
                      <div
                        className="se-markdown-content"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(currentSlide.detailed_explanation) }}
                      />

                      <div className="se-slide-actions">
                        <button
                          className={`se-action-btn se-action-insights ${showInsights[currentSlide.slide_number] ? 'active' : ''}`}
                          onClick={() => setShowInsights(prev => ({ ...prev, [currentSlide.slide_number]: !prev[currentSlide.slide_number] }))}
                        >
                          <Zap size={15} />
                          {showInsights[currentSlide.slide_number] ? 'Hide Insights' : 'Show Insights'}
                        </button>
                        <button
                          className="se-action-btn se-action-discuss"
                          onClick={() => navigate(`/ai-chat?slideRef=${encodeURIComponent(`${selectedSlide.filename} — Slide ${currentSlide.slide_number}: ${currentSlide.title || ''}`)}`)}
                        >
                          <MessageSquare size={15} />
                          Discuss with AI
                        </button>
                      </div>

                      {showInsights[currentSlide.slide_number] && (
                        <div className="se-insights-panel">
                          {currentSlide.key_concepts && currentSlide.key_concepts.length > 0 && (
                            <div className="se-insight-section">
                              <div className="se-insight-header"><Lightbulb size={15} /><span>Key Concepts</span></div>
                              <div className="se-concept-tags">
                                {currentSlide.key_concepts.map((c, i) => <span key={i} className="se-concept-tag">{c}</span>)}
                              </div>
                            </div>
                          )}
                          {currentSlide.definitions && Object.keys(currentSlide.definitions).length > 0 && (
                            <div className="se-insight-section">
                              <div className="se-insight-header"><Tag size={15} /><span>Definitions</span></div>
                              <div className="se-definitions-grid">
                                {Object.entries(currentSlide.definitions).map(([term, def], i) => (
                                  <div key={i} className="se-definition-card">
                                    <h4 className="se-definition-term">{term}</h4>
                                    <p className="se-definition-text">{def}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {currentSlide.exam_questions && currentSlide.exam_questions.length > 0 && (
                            <div className="se-insight-section">
                              <div className="se-insight-header"><Brain size={15} /><span>Practice Questions</span></div>
                              <div className="se-exam-questions">
                                {currentSlide.exam_questions.map((q, idx) => (
                                  <div key={idx} className="se-exam-question-card">
                                    <div className="se-question-header">
                                      <span className="se-question-number">Q{idx + 1}</span>
                                      <span className={`se-question-difficulty ${q.difficulty}`}>{q.difficulty}</span>
                                    </div>
                                    <p className="se-question-text">{q.question}</p>
                                    {q.answer_hint && <div className="se-answer-hint"><strong>Hint:</strong> {q.answer_hint}</div>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {currentSlide.study_tips && currentSlide.study_tips.length > 0 && (
                            <div className="se-insight-section">
                              <div className="se-insight-header"><BookOpen size={15} /><span>Study Tips</span></div>
                              <ul className="se-study-tips-list">
                                {currentSlide.study_tips.map((tip, i) => <li key={i}>{tip}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="se-no-explanation">
                      <Loader size={36} className="se-spinner" />
                      <p>Loading analysis...</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>

        {analyzing && (
          <div className="se-analyzing-overlay">
            <div className="se-analyzing-content">
              <div className="se-pulse-squares">
                <div className="se-pulse-sq" /><div className="se-pulse-sq" /><div className="se-pulse-sq" />
              </div>
              <h3 className="se-analyzing-title">Analyzing Presentation</h3>
              <p className="se-analyzing-sub">Extracting content and generating AI insights...</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── MAIN CARD GRID ────────────────────────────────────────────────
  return (
    <div className="se-page">
      <header className="se-header">
        <div className="se-header-left">
          <button className="nav-menu-btn" onClick={() => window.openGlobalNav && window.openGlobalNav()} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <h1 className="se-header-title" onClick={() => navigate('/search-hub')}>
            <div className="se-logo-img" />
            cerbyl
          </h1>
          <div className="se-header-divider" />
          <p className="se-header-subtitle">SLIDE EXPLORER</p>
        </div>
      </header>

      <div className="se-main-layout">
        <aside className="se-sidebar">
          <nav className="se-sidebar-nav">
            <button
              className={`se-nav-item ${activeView === 'grid' ? 'active' : ''}`}
              onClick={() => setActiveView('grid')}
            >
              <span className="se-nav-icon"><FileText size={20} /></span>
              <span className="se-nav-text">My Slides</span>
              {uploadedSlides.length > 0 && <span className="se-slide-count">{uploadedSlides.length}</span>}
            </button>
            <button
              className={`se-nav-item ${activeView === 'upload' ? 'active' : ''} se-upload-btn`}
              onClick={() => setActiveView('upload')}
              disabled={uploading}
            >
              <span className="se-nav-icon"><Upload size={20} /></span>
              <span className="se-nav-text">Upload New</span>
            </button>

            {uploadedSlides.length > 0 && (
              <div className="se-nav-section" style={{ marginTop: '16px' }}>
                <div className="se-nav-section-title">Recents</div>
                {uploadedSlides.slice(0, 6).map(slide => (
                  <div
                    key={slide.id}
                    className="se-slide-item"
                    onClick={() => analyzeSlide(slide.id)}
                  >
                    <span className="se-nav-icon"><FileText size={20} /></span>
                    <div className="se-slide-info">
                      <div className="se-slide-title">{slide.filename || 'Untitled'}</div>
                      <div className="se-slide-meta">{slide.page_count || 0} pages</div>
                    </div>
                    <button className="se-slide-delete-btn" onClick={(e) => deleteSlide(slide.id, e)} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </nav>

          <div className="se-sidebar-footer">
            <button className="se-tab-btn" onClick={() => navigate('/dashboard')}>
              <span className="se-nav-icon"><ChevronLeft size={20} /></span>
              <span className="se-nav-text">Dashboard</span>
            </button>
            <button className="se-tab-btn" onClick={() => navigate('/learning-review')}>
              <span className="se-nav-icon"><BookOpen size={20} /></span>
              <span className="se-nav-text">Learning Hub</span>
            </button>
          </div>
        </aside>

        <main className="se-main-content">
          {activeView === 'upload' ? (
            <div className="se-upload-view">
              <div className="se-upload-view-header">
                <h2 className="se-grid-title">UPLOAD PRESENTATION</h2>
                <p className="se-grid-subtitle">PDF or PowerPoint (.pptx, .ppt)</p>
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
                  {uploading ? <Loader size={56} className="se-spinner" /> : <UploadCloud size={56} />}
                </div>
                <p className="se-upload-title">{uploading ? 'Uploading...' : 'Drag files here or click to upload'}</p>
                <p className="se-upload-subtitle">Supports PDF and PowerPoint files</p>
                <input type="file" id="se-file-input" accept=".pdf,.pptx,.ppt" onChange={handleFileSelect} disabled={uploading} className="se-file-input" multiple />
              </div>
              {!uploading && (
                <button className="se-cancel-upload-btn" onClick={() => setActiveView('grid')}>
                  <ChevronLeft size={16} /> Back to My Slides
                </button>
              )}
            </div>
          ) : (
            <>
          <div className="se-grid-header">
            <div>
              <h2 className="se-grid-title">MY SLIDES</h2>
              <p className="se-grid-subtitle">
                {uploadedSlides.length} PRESENTATION{uploadedSlides.length !== 1 ? 'S' : ''} • {uploadedSlides.reduce((acc, s) => acc + (s.page_count || 0), 0)} SLIDES TOTAL
              </p>
            </div>
          </div>

          {loading ? (
            <div className="se-loading"><Loader size={40} className="se-spinner" /><p>Loading slides...</p></div>
          ) : uploadedSlides.length === 0 ? (
            <div className="se-empty-state">
              <div className="se-empty-icon-wrap"><FileText size={64} /></div>
              <h3>No presentations yet</h3>
              <p>Upload a PDF or PowerPoint to get started</p>
              <button className="se-empty-upload-btn" onClick={() => setActiveView('upload')}>
                <UploadCloud size={20} />
                Upload Presentation
              </button>
            </div>
          ) : (
            <div className="se-card-grid">
              {uploadedSlides.map((slide, index) => {
                const color = CARD_COLORS[index % CARD_COLORS.length];
                const date = new Date(slide.uploaded_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
                return (
                  <div key={slide.id} className="se-set-card">
                    {/* Thumbnail — image on top */}
                    <div className="se-set-thumbnail" style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)` }}>
                      <img
                        src={`${API_URL}/slide_image/${slide.id}/1`}
                        alt={slide.filename}
                        className="se-set-thumb-img"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <button className="se-delete-btn-thumb" onClick={(e) => deleteSlide(slide.id, e)}>
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Content below */}
                    <div className="se-set-content">
                      <p className="se-set-date">Created: {date}</p>
                      <h3 className="se-set-title">
                        {(slide.filename || 'Untitled').replace(/\.(pdf|pptx|ppt)$/i, '')}
                      </h3>
                      <p className="se-set-count">{slide.page_count || 0} SLIDES</p>
                    </div>

                    <div className="se-set-actions">
                      <button className="se-action-btn-view" onClick={() => analyzeSlide(slide.id)} disabled={analyzing}>
                        <span>VIEW</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
            </>
          )}
        </main>
      </div>

      {analyzing && (
        <div className="se-analyzing-overlay">
          <div className="se-analyzing-content">
            <div className="se-pulse-squares">
              <div className="se-pulse-sq" /><div className="se-pulse-sq" /><div className="se-pulse-sq" />
            </div>
            <h3 className="se-analyzing-title">Analyzing Presentation</h3>
            <p className="se-analyzing-sub">Extracting content and generating AI insights...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlideExplorer;
