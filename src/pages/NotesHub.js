import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic, BookOpen, Zap, ChevronRight, ArrowLeft, LayoutDashboard, MessageSquare, LogOut
} from 'lucide-react';
import './NotesHub.css';
import './NotesHubConvert.css';
import ImportExportModal from '../components/ImportExportModal';

const NotesHub = () => {
  const navigate = useNavigate();
  const [showImportExport, setShowImportExport] = useState(false);
  const [hoveredSection, setHoveredSection] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  return (
    <div className="nh notes-hub-page">
      <svg className="geo-bg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <circle cx="600" cy="400" r="360" fill="none" stroke="currentColor" strokeWidth="1"/>
        <circle cx="600" cy="400" r="260" fill="none" stroke="currentColor" strokeWidth="0.8"/>
        <circle cx="600" cy="400" r="168" fill="none" stroke="currentColor" strokeWidth="0.7"/>
        <circle cx="600" cy="400" r="90" fill="none" stroke="currentColor" strokeWidth="0.6"/>
        <line x1="600" y1="0" x2="600" y2="800" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="0" y1="400" x2="1200" y2="400" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="0" y1="800" x2="500" y2="0" stroke="currentColor" strokeWidth="0.4"/>
        <line x1="1200" y1="0" x2="700" y2="800" stroke="currentColor" strokeWidth="0.4"/>
        <circle cx="600" cy="40" r="5" fill="currentColor"/>
        <circle cx="600" cy="760" r="5" fill="currentColor"/>
        <circle cx="240" cy="400" r="5" fill="currentColor"/>
        <circle cx="960" cy="400" r="5" fill="currentColor"/>
        <circle cx="345" cy="146" r="3.5" fill="currentColor"/>
        <circle cx="855" cy="654" r="3.5" fill="currentColor"/>
        <circle cx="855" cy="146" r="3.5" fill="currentColor"/>
        <circle cx="345" cy="654" r="3.5" fill="currentColor"/>
        <rect x="24" y="24" width="72" height="72" fill="none" stroke="currentColor" strokeWidth="0.8"/>
        <rect x="44" y="44" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="0.5"/>
        <circle cx="60" cy="60" r="3" fill="currentColor"/>
        <rect x="1104" y="704" width="72" height="72" fill="none" stroke="currentColor" strokeWidth="0.8"/>
        <rect x="1124" y="724" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="0.5"/>
        <circle cx="1140" cy="740" r="3" fill="currentColor"/>
        <circle cx="120" cy="200" r="2" fill="currentColor"/>
        <circle cx="160" cy="160" r="1.5" fill="currentColor"/>
        <circle cx="200" cy="200" r="2" fill="currentColor"/>
        <circle cx="160" cy="240" r="1.5" fill="currentColor"/>
        <circle cx="1080" cy="600" r="2" fill="currentColor"/>
        <circle cx="1040" cy="640" r="1.5" fill="currentColor"/>
        <circle cx="1000" cy="600" r="2" fill="currentColor"/>
        <circle cx="1040" cy="560" r="1.5" fill="currentColor"/>
      </svg>
      <div className="nh-ambient">
        <div className="nh-ambient-orb nh-ambient-orb-1"></div>
        <div className="nh-ambient-orb nh-ambient-orb-2"></div>
        <div className="nh-ambient-grid"></div>
      </div>

      <div className="nh-layout-body nh-qb-body">
        <div className={`nh-qb-shell ${sidebarCollapsed ? 'nh-qb-shell--collapsed' : ''}`}>
          <aside className={`nh-qb-sidebar ${sidebarCollapsed ? 'nh-qb-sidebar--collapsed' : ''}`} aria-label="Notes navigation">
            {sidebarCollapsed ? (
              <div className="nh-qb-collapsed-strip">
                <button className="nh-qb-strip-btn nh-qb-strip-logo" data-tip="Open sidebar" onClick={() => setSidebarCollapsed(false)} type="button">
                  cb
                </button>
                <button className="nh-qb-strip-btn" data-tip="AI Media Notes" onClick={() => navigate('/notes/ai-media')} type="button">
                  <Mic size={18} />
                </button>
                <button className="nh-qb-strip-btn" data-tip="My Notes" onClick={() => navigate('/notes/my-notes')} type="button">
                  <BookOpen size={18} />
                </button>
                <button className="nh-qb-strip-btn" data-tip="Convert" onClick={() => setShowImportExport(true)} type="button">
                  <Zap size={18} />
                </button>
                <div className="nh-qb-strip-spacer" />
                <button className="nh-qb-strip-btn" data-tip="AI Chat" onClick={() => navigate('/ai-chat')} type="button">
                  <MessageSquare size={18} />
                </button>
                <button className="nh-qb-strip-btn" data-tip="Dashboard" onClick={() => navigate('/dashboard-cerbyl')} type="button">
                  <LayoutDashboard size={18} />
                </button>
                <button
                  className="nh-qb-strip-btn"
                  data-tip="Logout"
                  onClick={() => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('username');
                    navigate('/');
                  }}
                  type="button"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
            <>
              <div className="nh-qb-side-brand">
                <div className="nh-qb-brand-wrap">
                  <div className="nh-qb-brand">cerbyl</div>
                  <div className="nh-qb-current-title">Notes</div>
                </div>
                <button
                  className="nh-qb-side-close-btn"
                  onClick={() => setSidebarCollapsed(true)}
                  title="Close sidebar"
                  aria-label="Close notes sidebar"
                  type="button"
                >
                  <ArrowLeft size={14} />
                </button>
              </div>

              <div className="nh-qb-side-block nh-qb-side-block--grow">
                <div className="nh-qb-side-label">Views</div>
                <nav className="nh-qb-view-nav" aria-label="Notes views">
                  <button className="nh-qb-view-link" onClick={() => navigate('/notes/ai-media')} type="button">
                    <Mic size={16} />
                    <span>AI Media Notes</span>
                  </button>
                  <button className="nh-qb-view-link" onClick={() => navigate('/notes/my-notes')} type="button">
                    <BookOpen size={16} />
                    <span>My Notes</span>
                  </button>
                </nav>
              </div>

              <div className="nh-qb-side-block">
                <div className="nh-qb-side-label">Actions</div>
                <nav className="nh-qb-view-nav" aria-label="Notes actions">
                  <button className="nh-qb-view-link nh-qb-view-link--accent" onClick={() => setShowImportExport(true)} type="button">
                    <Zap size={16} />
                    <span>Convert</span>
                  </button>
                </nav>
              </div>

              <div className="nh-qb-side-actions">
                <button
                  className="nh-qb-action-btn nh-qb-action-btn--ghost"
                  onClick={() => navigate('/dashboard-cerbyl')}
                  type="button"
                >
                  <LayoutDashboard size={14} />
                  <span>Dashboard</span>
                </button>
                <button
                  className="nh-qb-action-btn nh-qb-action-btn--ghost"
                  onClick={() => navigate('/ai-chat')}
                  type="button"
                >
                  <MessageSquare size={14} />
                  <span>AI Chat</span>
                </button>
                <button
                  className="nh-qb-action-btn nh-qb-action-btn--ghost"
                  onClick={() => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('username');
                    navigate('/');
                  }}
                  type="button"
                >
                  <LogOut size={14} />
                  <span>Logout</span>
                </button>
              </div>
            </>
            )}
          </aside>

          <main className="nh-main nh-qb-main">
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
                <div className="view-heading">
                  <span className="view-kicker">AI-Powered</span>
                  <h2 className="view-title">AI Media Notes</h2>
                  <p className="view-sub">Transcription from audio, video & YouTube</p>
                </div>

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
                <div className="view-heading">
                  <span className="view-kicker">Manual</span>
                  <h2 className="view-title">My Notes</h2>
                  <p className="view-sub">Write, organize & manage your notes</p>
                </div>

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
        </div>
      </div>

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
            } else if (result.destinationType === 'podcast') {
              const noteIds = Array.isArray(result.note_ids) ? result.note_ids.join(',') : '';
              const route = noteIds ? `/notes/podcast?note_ids=${encodeURIComponent(noteIds)}` : '/notes/podcast';
              navigate(route, { state: { podcastPayload: result } });
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
