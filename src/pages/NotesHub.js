import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, ChevronRight, Clock3, FileText, Headphones,
  LayoutTemplate, Library, Loader2, Mic, Plus
} from 'lucide-react';
import './NotesHub.css';
import SocialHubChrome from '../components/SocialHubChrome';
import NewNoteDialog from '../components/NewNoteDialog';
import { API_URL } from '../config';

const plainText = (html = '') => html
  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();

const formatRelativeDate = (value) => {
  if (!value) return 'Recently edited';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently edited';
  const diff = Math.max(0, Date.now() - date.getTime());
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Edited just now';
  if (hours < 24) return `Edited ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Edited ${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

function NotesHub() {
  const navigate = useNavigate();
  const [recentNotes, setRecentNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [createError, setCreateError] = useState('');
  const [reload, setReload] = useState(0);
  const [showNewNote, setShowNewNote] = useState(false);
  const userName = localStorage.getItem('username');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const loadRecentNotes = async () => {
      setLoading(true); setLoadError('');
      if (!userName) {
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(`${API_URL}/get_notes?user_id=${encodeURIComponent(userName)}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Could not load your recent notes.');
        const data = await response.json();
        const sorted = (Array.isArray(data) ? data : [])
          .filter((note) => !note.is_deleted)
          .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
          .slice(0, 4);
        setRecentNotes(sorted);
      } catch {
        setLoadError('Could not load your recent notes.');
      } finally {
        setLoading(false);
      }
    };

    loadRecentNotes();
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [userName, reload]);

  const createNote = async () => {
    if (creating) return;
    setCreating(true);
    setCreateError('');
    try {
      const response = await fetch(`${API_URL}/create_note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          user_id: userName,
          title: 'Untitled note',
          content: '',
          folder_id: null
        })
      });
      if (!response.ok) throw new Error('Could not create a note');
      const note = await response.json();
      navigate(`/notes/editor/${note.id}`);
    } catch {
      setCreateError('Could not create a note. Please try again.');
      setCreating(false);
    }
  };

  const chooseNewNote = (choice) => {
    if (choice === 'blank') { createNote(); return; }
    setShowNewNote(false);
    if (choice === 'media') navigate('/notes/ai-media');
    else navigate('/notes/my-notes', { state: { createFrom: choice } });
  };

  const sidebarLead = (
    <button className="nh-side-create" type="button" onClick={() => { setCreateError(''); setShowNewNote(true); }} aria-haspopup="dialog">
      <Plus size={15} aria-hidden="true" />
      <span>New note</span>
    </button>
  );

  return (
    <div className="nh with-social-chrome">
      <SocialHubChrome
        brandKicker="Notes"
        sidebarLead={sidebarLead}
        sideSections={[
          {
            label: 'Workspace',
            items: [
              { icon: BookOpen, label: 'Overview', active: true, onClick: () => {} },
              { icon: Library, label: 'My Library', onClick: () => navigate('/notes/my-notes') },
              { icon: Mic, label: 'Media Notes', onClick: () => navigate('/notes/ai-media') },
            ],
          },
        ]}
      >
        <main className="nh-main">
          <header className="nh-hero">
            <div className="nh-hero-copy">
              <h1 className="plain-page-title">Notes Workspace</h1>
            </div>
          </header>

          {createError && <div className="nh-error" role="alert">{createError}</div>}

          <section className="nh-view">

            <div className="nh-capture-grid" aria-label="Capture options">
              <button className="nh-route-card nh-route-write" type="button" onClick={createNote} disabled={creating}>
                <span className="nh-route-top">
                  <span className="nh-route-number">Write</span>
                  <span className="nh-route-icon"><FileText size={22} /></span>
                </span>
                <span className="nh-route-copy">
                  <strong>Start with a blank page</strong>
                  <small>A focused editor for ideas, classes and working notes.</small>
                </span>
                <span className="nh-route-action">
                  {creating ? <><Loader2 className="nh-spin" size={14} />Opening editor</> : <>Open editor <ChevronRight size={15} /></>}
                </span>
              </button>

              <button className="nh-route-card nh-route-media" type="button" onClick={() => navigate('/notes/ai-media')}>
                <span className="nh-route-top">
                  <span className="nh-route-number">Transform</span>
                  <span className="nh-route-icon"><Headphones size={22} /></span>
                </span>
                <span className="nh-route-copy">
                  <strong>Turn media into study notes</strong>
                  <small>Keep the source, transcript and study material connected.</small>
                </span>
                <span className="nh-route-action">Add a source <ChevronRight size={15} /></span>
              </button>
            </div>

            <section className="nh-recent-panel">
              <div className="nh-panel-heading">
                <div><h2>Recent notes</h2></div>
                <button type="button" onClick={() => navigate('/notes/my-notes')}>View library <ChevronRight size={14} /></button>
              </div>

              <div className="nh-recent-list">
                {loading ? (
                  <div className="nh-loading"><Loader2 className="nh-spin" size={20} />Finding your latest work…</div>
                ) : loadError ? (
                  <div className="nh-empty-recent" role="alert">
                    <div><strong>{loadError}</strong><span>Check your connection and try again.</span></div>
                    <button type="button" onClick={() => setReload(n => n + 1)}>Retry</button>
                  </div>
                ) : recentNotes.length > 0 ? recentNotes.map((note) => (
                  <button className="nh-note-row" type="button" key={note.id} aria-label={`Open ${note.title || "Untitled note"}`} onClick={() => navigate(`/notes/editor/${note.id}`)}>
                    <span className="nh-note-body">
                      <strong>{note.title || 'Untitled note'}</strong>
                      <small>{plainText(note.content).slice(0, 180) || 'Empty note — ready for your first thought.'}</small>
                    </span>
                    <span className="nh-note-date"><Clock3 size={13} />{formatRelativeDate(note.updated_at || note.created_at)}</span>
                    <ChevronRight className="nh-note-arrow" size={16} />
                  </button>
                )) : (
                  <div className="nh-empty-recent">
                    <span className="nh-empty-icon"><LayoutTemplate size={20} /></span>
                    <div><strong>Your latest notes will live here.</strong><span>Create a note or transform a source to begin.</span></div>
                    <button type="button" onClick={createNote}>Create first note</button>
                  </div>
                )}
              </div>
            </section>
          </section>
        </main>
      </SocialHubChrome>
      <NewNoteDialog
        open={showNewNote}
        onClose={() => setShowNewNote(false)}
        onChoose={chooseNewNote}
        busy={creating}
        error={createError}
      />
    </div>
  );
}

export default NotesHub;
