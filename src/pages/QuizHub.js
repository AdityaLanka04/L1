import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Brain, ChevronRight, CircleHelp, FileInput, Swords } from 'lucide-react';
import './QuizHub.css';
import SocialHubChrome from '../components/SocialHubChrome';
import ImportExportModal from '../components/ImportExportModal';

const QuizHub = () => {
  const navigate = useNavigate();
  const [showImportExport, setShowImportExport] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

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

  return (
    <div className="qh with-social-chrome">
      <SocialHubChrome
        brandKicker="Quiz"
        sidebarLead={sidebarLead}
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
                <ChevronRight className="qh-card-arrow" size={22} />
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
    </div>
  );
};

export default QuizHub;
