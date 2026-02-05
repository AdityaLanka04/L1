import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic, BookOpen, Zap, ChevronRight
} from 'lucide-react';
import './NotesHub.css';
import './NotesHubConvert.css';
import ImportExportModal from '../components/ImportExportModal';

const NotesHub = () => {
  const navigate = useNavigate();
  const [showImportExport, setShowImportExport] = useState(false);
  const [hoveredSection, setHoveredSection] = useState(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  return (
    <div className="nh">
      {/* Ambient Background */}
      <div className="nh-ambient">
        <div className="nh-ambient-orb nh-ambient-orb-1"></div>
        <div className="nh-ambient-orb nh-ambient-orb-2"></div>
        <div className="nh-ambient-grid"></div>
      </div>

      {/* Header */}
      <header className="nh-header">
        <div className="nh-header-left">
          <h1 className="nh-logo" onClick={() => window.openGlobalNav && window.openGlobalNav()}>
            <div className="nh-logo-img" />
            cerbyl
          </h1>
          <div className="nh-header-divider"></div>
          <span className="nh-subtitle">STUDY NOTES</span>
        </div>
        <nav className="nh-header-right">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowImportExport(true);
            }} 
            className="nh-nav-btn nh-nav-btn-accent"
          >
            <Zap size={16} />
            <span>Convert</span>
          </button>
          <button className="nh-nav-btn nh-nav-btn-ghost" onClick={() => navigate('/dashboard')}>
            <span>Dashboard</span>
            <ChevronRight size={14} />
          </button>
        </nav>
      </header>

      {/* Main Content - Split View */}
      <main className="nh-main">
        {/* Left Section - AI Media Notes */}
        <section 
          className={`nh-section nh-section-ai ${hoveredSection === 'ai' ? 'nh-section-hovered' : ''}`}
          onClick={() => navigate('/notes/ai-media')}
          onMouseEnter={() => setHoveredSection('ai')}
          onMouseLeave={() => setHoveredSection(null)}
        >
          <div className="nh-section-glow"></div>
          <div className="nh-section-inner">
            <div className="nh-section-icon">
              <Mic size={40} strokeWidth={1.5} />
            </div>
            
            <div className="nh-section-content">
              <h2 className="nh-section-title">AI Media Notes</h2>
              <p className="nh-section-tag">AI-Powered Transcription</p>
              
              <div className="nh-features">
                <div className="nh-feature">
                  <ChevronRight size={14} />
                  <span>Audio & Video Files</span>
                </div>
                <div className="nh-feature">
                  <ChevronRight size={14} />
                  <span>YouTube Transcripts</span>
                </div>
                <div className="nh-feature">
                  <ChevronRight size={14} />
                  <span>Smart Notes</span>
                </div>
              </div>
            </div>

            <button className="nh-section-cta">
              <span>Start Generating</span>
            </button>
          </div>
          <div className="nh-section-line"></div>
        </section>

        {/* Divider */}
        <div className="nh-divider">
          <span className="nh-divider-text">or</span>
        </div>

        {/* Right Section - My Notes */}
        <section 
          className={`nh-section nh-section-manual ${hoveredSection === 'manual' ? 'nh-section-hovered' : ''}`}
          onClick={() => navigate('/notes/my-notes')}
          onMouseEnter={() => setHoveredSection('manual')}
          onMouseLeave={() => setHoveredSection(null)}
        >
          <div className="nh-section-glow"></div>
          <div className="nh-section-inner">
            <div className="nh-section-icon">
              <BookOpen size={40} strokeWidth={1.5} />
            </div>
            
            <div className="nh-section-content">
              <h2 className="nh-section-title">My Notes</h2>
              <p className="nh-section-tag">Manual Note-Taking</p>
              
              <div className="nh-features">
                <div className="nh-feature">
                  <ChevronRight size={14} />
                  <span>Rich Text Editor</span>
                </div>
                <div className="nh-feature">
                  <ChevronRight size={14} />
                  <span>Organize Notes</span>
                </div>
                <div className="nh-feature">
                  <ChevronRight size={14} />
                  <span>Personal Library</span>
                </div>
              </div>
            </div>

            <button className="nh-section-cta">
              <span>View My Notes</span>
            </button>
          </div>
          <div className="nh-section-line"></div>
        </section>
      </main>
      
      <ImportExportModal
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        mode="import"
        sourceType="notes"
        onSuccess={(result) => {
          alert("Successfully converted notes!");
        }}
      />
    </div>
  );
};

export default NotesHub;
