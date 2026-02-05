import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Users, Swords, ChevronRight, Zap } from 'lucide-react';
import './QuizHub.css';
import ImportExportModal from '../components/ImportExportModal';

const QuizHub = () => {
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
    <div className="qh">
      {/* Ambient Background */}
      <div className="qh-ambient">
        <div className="qh-ambient-orb qh-ambient-orb-1"></div>
        <div className="qh-ambient-orb qh-ambient-orb-2"></div>
        <div className="qh-ambient-grid"></div>
      </div>

      {/* Header */}
      <header className="qh-header">
        <div className="qh-header-left">
          <h1 className="qh-logo" onClick={() => window.openGlobalNav && window.openGlobalNav()}>
            <div className="qh-logo-img" />
            cerbyl
          </h1>
          <div className="qh-header-divider"></div>
          <span className="qh-subtitle">QUIZ HUB</span>
        </div>
        <nav className="qh-header-right">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowImportExport(true);
            }} 
            className="qh-nav-btn qh-nav-btn-accent"
          >
            <Zap size={16} />
            <span>Convert</span>
          </button>
          <button className="qh-nav-btn qh-nav-btn-ghost" onClick={() => navigate('/dashboard')}>
            <span>Dashboard</span>
            <ChevronRight size={14} />
          </button>
        </nav>
      </header>

      {/* Main Content - Split View */}
      <main className="qh-main">
        {/* Left Section - Solo Practice */}
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

        {/* Divider */}
        <div className="qh-divider">
          <span className="qh-divider-text">or</span>
        </div>

        {/* Right Section - 1v1 Battles */}
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

      {/* Import/Export Modal */}
      <ImportExportModal
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        mode="import"
        sourceType="quiz"
        onSuccess={(result) => {
          alert("Successfully converted to quiz!");
        }}
      />
    </div>
  );
};

export default QuizHub;