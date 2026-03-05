import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Swords, ChevronRight, Zap, Menu } from 'lucide-react';
import './QuizHub.css';
import ImportExportModal from '../components/ImportExportModal';
import ContextSelector from '../components/ContextSelector';
import ContextPanel from '../components/ContextPanel';
import contextService from '../services/contextService';

const QuizHub = () => {
  const navigate = useNavigate();
  const [showImportExport, setShowImportExport] = useState(false);
  const [hoveredSection, setHoveredSection] = useState(null);
  const [contextPanelOpen, setContextPanelOpen] = useState(false);
  const [hsMode, setHsMode] = useState(() => localStorage.getItem('hs_mode_enabled') === 'true');
  const [userDocCount, setUserDocCount] = useState(0);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    contextService.listDocuments()
      .then(d => setUserDocCount(d.user_docs?.length || 0))
      .catch(() => {});
  }, []);

  const handleHsModeToggle = (val) => {
    setHsMode(val);
    localStorage.setItem('hs_mode_enabled', String(val));
  };

  return (
    <div className="qh">
      <div className="qh-ambient">
        <div className="qh-ambient-orb qh-ambient-orb-1"></div>
        <div className="qh-ambient-orb qh-ambient-orb-2"></div>
        <div className="qh-ambient-grid"></div>
      </div>

      <header className="qh-header">
        <div className="qh-header-left">
          <button className="nav-menu-btn" onClick={() => window.openGlobalNav && window.openGlobalNav()} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <h1 className="qh-logo" onClick={() => navigate('/search-hub')}>
            <div className="qh-logo-img" />
            cerbyl
          </h1>
          <div className="qh-header-divider"></div>
          <span className="qh-subtitle">QUIZ HUB</span>
        </div>
        <nav className="qh-header-right">
          <ContextSelector hsMode={hsMode} docCount={userDocCount} onOpen={() => setContextPanelOpen(true)} />
          <button
            onClick={(e) => { e.stopPropagation(); setShowImportExport(true); }}
            className="qh-nav-btn qh-nav-btn-accent"
          >
            <Zap size={16} />
            <span>Convert</span>
          </button>
        </nav>
      </header>

      <div className="qh-layout-body">
        <main className="qh-main">
        <section 
          className={`qh-section qh-section-solo ${hoveredSection === 'solo' ? 'qh-section-hovered' : ''}`}
          onClick={() => navigate('/solo-quiz')}
          onMouseEnter={() => setHoveredSection('solo')}
          onMouseLeave={() => setHoveredSection(null)}
        >
          <div className="qh-section-glow"></div>
          <div className="qh-section-inner">
            <div className="qh-section-icon">
              <User size={40} strokeWidth={1.5} />
            </div>
            
            <div className="qh-section-content">
              <h2 className="qh-section-title">Solo Practice</h2>
              <p className="qh-section-tag">Practice at Your Own Pace</p>
              
              <div className="qh-features">
                <div className="qh-feature">
                  <ChevronRight size={14} />
                  <span>Smart Questions</span>
                </div>
                <div className="qh-feature">
                  <ChevronRight size={14} />
                  <span>Personal Progress Tracking</span>
                </div>
                <div className="qh-feature">
                  <ChevronRight size={14} />
                  <span>Learn from Mistakes</span>
                </div>
              </div>
            </div>

            <button className="qh-section-cta">
              <span>Start Solo Quiz</span>
            </button>
          </div>
          <div className="qh-section-line"></div>
        </section>

        <div className="qh-divider">
          <span className="qh-divider-text">or</span>
        </div>

        <section 
          className={`qh-section qh-section-battle ${hoveredSection === 'battle' ? 'qh-section-hovered' : ''}`}
          onClick={() => navigate('/quiz-battles')}
          onMouseEnter={() => setHoveredSection('battle')}
          onMouseLeave={() => setHoveredSection(null)}
        >
          <div className="qh-section-glow"></div>
          <div className="qh-section-inner">
            <div className="qh-section-icon">
              <Swords size={40} strokeWidth={1.5} />
            </div>
            
            <div className="qh-section-content">
              <h2 className="qh-section-title">1v1 Battles</h2>
              <p className="qh-section-tag">Challenge Your Friends</p>
              
              <div className="qh-features">
                <div className="qh-feature">
                  <ChevronRight size={14} />
                  <span>Compete with Friends</span>
                </div>
                <div className="qh-feature">
                  <ChevronRight size={14} />
                  <span>Real-time Battles</span>
                </div>
                <div className="qh-feature">
                  <ChevronRight size={14} />
                  <span>Live Notifications</span>
                </div>
              </div>
            </div>

            <button className="qh-section-cta">
              <span>Start Battle</span>
            </button>
          </div>
          <div className="qh-section-line"></div>
        </section>
      </main>
      </div>

      <ImportExportModal
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        mode="import"
        sourceType="questions"
        onSuccess={(result) => {
          if (result?.shouldNavigate) {
            if (result.destinationType === 'flashcards') {
              if (result.set_id) {
                navigate(`/flashcards?set_id=${result.set_id}&mode=preview`);
              } else {
                navigate('/flashcards');
              }
            } else if (result.destinationType === 'notes') {
              if (result.note_id) {
                navigate(`/notes/editor/${result.note_id}`);
              } else {
                navigate('/notes');
              }
            }
          } else {
            alert("Successfully converted questions!");
          }
        }}
      />

      <ContextPanel
        isOpen={contextPanelOpen}
        onClose={() => setContextPanelOpen(false)}
        hsMode={hsMode}
        onHsModeToggle={handleHsModeToggle}
        onDocUploaded={() => setUserDocCount(p => p + 1)}
      />
    </div>
  );
};

export default QuizHub;
