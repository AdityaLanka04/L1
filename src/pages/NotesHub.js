import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic, BookOpen, Zap, ChevronRight
, Menu} from 'lucide-react';
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
      <svg className="geo-bg" viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="600" cy="400" r="360" fill="none" stroke="currentColor" strokeWidth="1"/>
        <circle cx="600" cy="400" r="260" fill="none" stroke="currentColor" strokeWidth="0.5"/>
        <circle cx="600" cy="400" r="168" fill="none" stroke="currentColor" strokeWidth="0.5"/>
        <circle cx="600" cy="400" r="90" fill="none" stroke="currentColor" strokeWidth="1"/>
        <line x1="600" y1="40" x2="600" y2="760" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="240" y1="400" x2="960" y2="400" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="346" y1="146" x2="854" y2="654" stroke="currentColor" strokeWidth="0.3"/>
        <line x1="854" y1="146" x2="346" y2="654" stroke="currentColor" strokeWidth="0.3"/>
        <circle cx="600" cy="40" r="4" fill="currentColor"/>
        <circle cx="960" cy="400" r="4" fill="currentColor"/>
        <circle cx="600" cy="760" r="4" fill="currentColor"/>
        <circle cx="240" cy="400" r="4" fill="currentColor"/>
        <rect x="580" y="20" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="0.5"/>
        <rect x="940" y="380" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="0.5"/>
        <circle cx="854" cy="146" r="3" fill="currentColor" opacity="0.5"/>
        <circle cx="346" cy="146" r="3" fill="currentColor" opacity="0.5"/>
        <circle cx="854" cy="654" r="3" fill="currentColor" opacity="0.5"/>
        <circle cx="346" cy="654" r="3" fill="currentColor" opacity="0.5"/>
        <circle cx="120" cy="160" r="2" fill="currentColor" opacity="0.4"/>
        <circle cx="1050" cy="200" r="2" fill="currentColor" opacity="0.4"/>
        <circle cx="80" cy="600" r="2" fill="currentColor" opacity="0.4"/>
        <circle cx="1100" cy="580" r="2" fill="currentColor" opacity="0.4"/>
      </svg>
      <div className="nh-ambient">
        <div className="nh-ambient-orb nh-ambient-orb-1"></div>
        <div className="nh-ambient-orb nh-ambient-orb-2"></div>
        <div className="nh-ambient-grid"></div>
      </div>

      <header className="nh-header">
        <div className="nh-header-left">
          <button className="nav-menu-btn" onClick={() => window.openGlobalNav && window.openGlobalNav()} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <h1 className="nh-logo" onClick={() => navigate('/search-hub')}>
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

      <main className="nh-main">
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

        <div className="nh-divider">
          <span className="nh-divider-text">or</span>
        </div>

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
          if (result?.shouldNavigate) {
            if (result.destinationType === 'flashcards') {
              if (result.set_id) {
                navigate(`/flashcards?set_id=${result.set_id}&mode=preview`);
              } else {
                navigate('/flashcards');
              }
            } else if (result.destinationType === 'questions') {
              navigate('/question-bank');
            } else if (result.destinationType === 'notes') {
              if (result.note_id) {
                navigate(`/notes/editor/${result.note_id}`);
              } else {
                navigate('/notes');
              }
            }
          } else {
            alert("Successfully converted notes!");
          }
        }}
      />
    </div>
  );
};

export default NotesHub;
