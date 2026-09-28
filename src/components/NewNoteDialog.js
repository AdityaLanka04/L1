import { FileText, Layout, MessageSquare, Layers, Headphones, X, ChevronRight, Loader2 } from 'lucide-react';
import useModalFocus from '../hooks/useModalFocus';
import './NewNoteDialog.css';

const OPTIONS = [
  { id: 'blank', icon: FileText, title: 'Blank note', detail: 'Start writing on an empty page.' },
  { id: 'template', icon: Layout, title: 'From a template', detail: 'Start from a ready-made layout.' },
  { id: 'chat', icon: MessageSquare, title: 'From an AI chat', detail: 'Turn a conversation into a note.' },
  { id: 'flashcards', icon: Layers, title: 'From flashcards or quizzes', detail: 'Summarise a set you have studied.' },
  { id: 'media', icon: Headphones, title: 'From a PDF, audio or video', detail: 'Generate study notes from a file.' },
];

export default function NewNoteDialog({ open, onClose, onChoose, busy = false, error = '' }) {
  const dialogRef = useModalFocus(open, onClose);
  if (!open) return null;

  return (
    <div className="nn-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section
        ref={dialogRef}
        className="nn-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nn-dialog-title"
        tabIndex={-1}
      >
        <header className="nn-head">
          <h2 id="nn-dialog-title">New note</h2>
          <button type="button" className="nn-close" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <ul className="nn-options">
          {OPTIONS.map(({ id, icon: Icon, title, detail }) => (
            <li key={id}>
              <button type="button" className="nn-option" onClick={() => onChoose(id)} disabled={busy}>
                <span className="nn-option-icon" aria-hidden="true">
                  {busy && id === 'blank' ? <Loader2 size={18} className="nn-spin" /> : <Icon size={18} />}
                </span>
                <span className="nn-option-copy">
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </span>
                <ChevronRight size={16} className="nn-option-chevron" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>

        {error && <p className="nn-error" role="alert">{error}</p>}
      </section>
    </div>
  );
}
