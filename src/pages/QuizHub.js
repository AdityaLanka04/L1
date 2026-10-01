import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, BookOpen, Brain, CircleHelp, FileInput, Swords } from 'lucide-react';
import './QuizHub.css';
import SocialHubChrome from '../components/SocialHubChrome';
import ImportExportModal from '../components/ImportExportModal';
import ContextSelector from '../components/ContextSelector';
import ContextPanel from '../components/ContextPanel';
import contextService from '../services/contextService';

const QuizHub = () => {
  const navigate = useNavigate();
  const [showImportExport, setShowImportExport] = useState(false);
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
      .then((data) => setUserDocCount(data.user_docs?.length || 0))
      .catch(() => {});
  }, []);

  const handleHsModeToggle = (value) => {
    setHsMode(value);
    localStorage.setItem('hs_mode_enabled', String(value));
  };

  const openMode = (path) => navigate(path);

  const modes = [
    { key: 'solo', icon: Brain, title: 'Solo Quiz', copy: 'Practice any topic at your own pace.', path: '/solo-quiz' },
    { key: 'battle', icon: Swords, title: 'Quiz Battles', copy: 'Challenge a friend to a live 1v1 quiz.', path: '/quiz-battles' },
  ];

  const sidebarLead = (
    <button className="qh-side-primary" type="button" onClick={() => openMode('/solo-quiz')}>
      <Brain size={15} />
      <span>New practice</span>
    </button>
  );

  const sidebarTail = (
    <div className="qh-context-card">
      <span className="qh-context-card-label">Study context</span>
      <ContextSelector
        hsMode={hsMode}
        docCount={userDocCount}
        onOpen={() => setContextPanelOpen(true)}
      />
      <small>{hsMode ? 'Curriculum context is active' : userDocCount ? `${userDocCount} source${userDocCount === 1 ? '' : 's'} available` : 'Add a source when you need one'}</small>
    </div>
  );

  return (
    <div className="qh with-social-chrome">
      <SocialHubChrome
        brandKicker="Quiz"
        sidebarLead={sidebarLead}
        sidebarTail={sidebarTail}
        sideSections={[
          {
            label: 'Quiz studio',
            items: [
              { icon: CircleHelp, label: 'Choose a mode', active: true, onClick: () => {} },
              { icon: Brain, label: 'Solo setup', onClick: () => openMode('/solo-quiz') },
              { icon: Swords, label: 'Battle arena', onClick: () => openMode('/quiz-battles') },
            ],
          },
          {
            label: 'Study tools',
            items: [
              { icon: BookOpen, label: 'Question Hub', onClick: () => openMode('/question-bank') },
              { icon: FileInput, label: 'Convert questions', onClick: () => setShowImportExport(true) },
            ],
          },
        ]}
      >
        <main className="qh-main">
          <header className="qh-hero">
            <h1 className="plain-page-title">Quiz Hub</h1>
          </header>

          <div className="qh-mode-grid">
            {modes.map(({ key, icon: Icon, title, copy, path }) => (
              <button key={key} type="button" className="qh-mode-card" onClick={() => openMode(path)}>
                <span className="qh-card-icon"><Icon size={20} /></span>
                <span className="qh-card-copy">
                  <strong>{title}</strong>
                  <small>{copy}</small>
                </span>
                <ArrowUpRight className="qh-card-arrow" size={18} />
              </button>
            ))}
          </div>
        </main>
      </SocialHubChrome>

      <ImportExportModal
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        mode="import"
        sourceType="questions"
        onSuccess={(result) => {
          if (result?.shouldNavigate) {
            if (result.destinationType === 'flashcards') {
              navigate(result.set_id ? `/flashcards?set_id=${result.set_id}&mode=preview` : '/flashcards');
            } else if (result.destinationType === 'notes') {
              navigate(result.note_id ? `/notes/editor/${result.note_id}` : '/notes');
            }
          } else {
            alert('Successfully converted questions!');
          }
        }}
      />

      <ContextPanel
        isOpen={contextPanelOpen}
        onClose={() => setContextPanelOpen(false)}
        hsMode={hsMode}
        onHsModeToggle={handleHsModeToggle}
        onDocUploaded={() => setUserDocCount((count) => count + 1)}
      />
    </div>
  );
};

export default QuizHub;
