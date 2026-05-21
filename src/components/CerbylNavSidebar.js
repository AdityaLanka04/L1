import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Pencil, X, Check, Search, LogOut } from 'lucide-react';
import './CerbylNavSidebar.css';

const PRESET_PFPS = [
  { id: 'cat', label: 'Cat', src: '/pfp/cat.png' },
  { id: 'woman', label: 'Woman', src: '/pfp/woman.png' }
];
const isPresetPfp = (src) => PRESET_PFPS.some(p => p.src === src);
const PFP_DEFAULT_KEY = 'cerbyl.defaultPfp';
const PFP_CUSTOM_KEY = 'cerbyl.customPfp';
const DISPLAY_NAME_KEY = 'cerbyl.displayName';

const hydrateProfile = (parsed = {}, username = '') => {
  const p = parsed || {};
  const storedDefault = localStorage.getItem(PFP_DEFAULT_KEY) || '';
  const storedCustom = localStorage.getItem(PFP_CUSTOM_KEY) || '';
  const storedDisplayName = localStorage.getItem(DISPLAY_NAME_KEY) || '';
  const hasExplicitCustom = Object.prototype.hasOwnProperty.call(p, 'customPfp');
  const hasExplicitDefault = Object.prototype.hasOwnProperty.call(p, 'defaultPfp');
  const picCandidate = p.picture_url || p.picture || p.photoURL || p.photo_url || '';
  const parsedCustom = p.customPfp && isPresetPfp(p.customPfp) ? p.customPfp : '';
  const customPfp = hasExplicitCustom
    ? parsedCustom
    : (parsedCustom || (isPresetPfp(storedCustom) ? storedCustom : '') || (isPresetPfp(picCandidate) ? picCandidate : ''));
  const defaultPfp = hasExplicitDefault
    ? (p.defaultPfp || '')
    : (p.defaultPfp || p.googlePicture || storedDefault || (isPresetPfp(picCandidate) ? '' : picCandidate) || '');
  const activePfp = customPfp || defaultPfp;
  const resolvedName = p.firstName || p.first_name || storedDisplayName || (username ? username.split('@')[0] : '');
  return {
    ...p,
    firstName: p.firstName || resolvedName,
    first_name: p.first_name || resolvedName,
    defaultPfp,
    customPfp,
    picture: activePfp,
    picture_url: activePfp
  };
};

const NAV_GROUPS = [
  {
    label: 'MAIN',
    links: [
      { label: 'Dashboard', route: '/dashboard-cerbyl' },
      { label: 'Cerbyl Dashboard', route: '/dashboard-cerbyl' },
      { label: 'Search Hub', route: '/search-hub' },
    ]
  },
  {
    label: 'LEARNING',
    links: [
      { label: 'AI Chat', route: '/ai-chat' },
      { label: 'Flashcards', route: '/flashcards' },
      { label: 'Notes', route: '/notes' },
      { label: 'Media Notes', route: '/notes/ai-media' },
      { label: 'Quiz Hub', route: '/quiz-hub' },
      { label: 'Slide Explorer', route: '/slide-explorer' },
      { label: 'ContextHub', route: '/contexthub' },
    ]
  },
  {
    label: 'PRACTICE',
    links: [
      { label: 'Question Bank', route: '/question-bank' },
      { label: 'Solo Quiz', route: '/solo-quiz' },
      { label: 'Weak Areas', route: '/weaknesses' },
      { label: 'Challenges', route: '/challenges' },
    ]
  },
  {
    label: 'PROGRESS',
    links: [
      { label: 'Analytics', route: '/analytics' },
      { label: 'XP Roadmap', route: '/xp-roadmap' },
      { label: 'Knowledge Roadmap', route: '/knowledge-roadmap' },
      { label: 'Activity Timeline', route: '/activity-timeline' },
      { label: 'Learning Paths', route: '/learning-paths' },
      { label: 'Playlists', route: '/playlists' },
    ]
  },
  {
    label: 'SOCIAL',
    links: [
      { label: 'Social Hub', route: '/social' },
      { label: 'Leaderboards', route: '/leaderboards' },
      { label: 'Games', route: '/games' },
      { label: 'Friends', route: '/friends' },
    ]
  },
];

const QUICK_SECTIONS = [
  { label: 'AI Chat', route: '/ai-chat' },
  { label: 'Flashcards', route: '/flashcards' },
  { label: 'Notes', route: '/notes' },
];

const CerbylNavSidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [pfpModalOpen, setPfpModalOpen] = useState(false);

  const [profile, setProfile] = useState(() => {
    const username = localStorage.getItem('username') || '';
    const raw = localStorage.getItem('userProfile');
    if (!raw) return hydrateProfile({}, username);
    try { return hydrateProfile(JSON.parse(raw), username); }
    catch (e) { return hydrateProfile({}, username); }
  });

  const userName = localStorage.getItem('username') || '';
  const displayName = profile?.firstName || profile?.first_name
    || localStorage.getItem(DISPLAY_NAME_KEY)
    || (userName ? userName.split('@')[0] : 'You');
  const initial = (displayName[0] || 'A').toUpperCase();
  const profilePhoto = profile?.picture || profile?.picture_url || profile?.photoURL || profile?.photo_url || '';
  const activeCustomPfp = profile?.customPfp || '';
  const defaultUserPfp = profile?.defaultPfp || '';

  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => setSearchQuery(''), 280);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const savePfpProfile = (nextProfile) => {
    let base = {};
    const raw = localStorage.getItem('userProfile');
    if (raw) try { base = JSON.parse(raw) || {}; } catch (e) {}
    const merged = hydrateProfile({ ...base, ...nextProfile }, userName);
    setProfile(merged);
    localStorage.setItem('userProfile', JSON.stringify(merged));
    if (merged.defaultPfp) localStorage.setItem(PFP_DEFAULT_KEY, merged.defaultPfp);
    if (merged.customPfp) localStorage.setItem(PFP_CUSTOM_KEY, merged.customPfp);
    else localStorage.removeItem(PFP_CUSTOM_KEY);
    const name = merged.firstName || merged.first_name || '';
    if (name) localStorage.setItem(DISPLAY_NAME_KEY, name);
  };

  const selectPresetPfp = (src) => {
    const cur = profile || {};
    const def = cur.defaultPfp || cur.googlePicture || cur.photoURL || cur.photo_url
      || (isPresetPfp(cur.picture_url || cur.picture || '') ? '' : (cur.picture_url || cur.picture || '')) || '';
    savePfpProfile({ ...cur, defaultPfp: def, customPfp: src, picture: src, picture_url: src });
    setPfpModalOpen(false);
  };

  const selectDefaultPfp = () => {
    const cur = profile || {};
    const def = cur.defaultPfp || cur.googlePicture || cur.photoURL || cur.photo_url
      || (isPresetPfp(cur.picture_url || cur.picture || '') ? '' : (cur.picture_url || cur.picture || '')) || '';
    savePfpProfile({ ...cur, defaultPfp: def, customPfp: '', picture: def, picture_url: def });
    setPfpModalOpen(false);
  };

  useEffect(() => {
    if (!pfpModalOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setPfpModalOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pfpModalOpen]);

  const handleNav = (route) => { navigate(route); onClose(); };
  const handleClose = () => { setSearchQuery(''); onClose(); };
  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    navigate('/login');
    onClose();
  };

  const userEmail = localStorage.getItem('email');
  const isAdmin = ['aditya.s.lanka@gmail.com', 'asphar057@gmail.com'].includes(userEmail);
  const allGroups = isAdmin
    ? [...NAV_GROUPS, { label: 'ADMIN', links: [{ label: 'Analytics Dashboard', route: '/admin/analytics' }] }]
    : NAV_GROUPS;

  const filteredGroups = searchQuery
    ? allGroups.map(g => ({
        ...g,
        links: g.links.filter(l => l.label.toLowerCase().includes(searchQuery.toLowerCase()))
      })).filter(g => g.links.length > 0)
    : allGroups;

  return (
    <>
      <div className={`cns-backdrop ${isOpen ? 'cns-backdrop--visible' : ''}`} onClick={handleClose} />

      <aside className={`cns-sidebar ${isOpen ? 'cns-sidebar--open' : ''}`} aria-hidden={!isOpen}>

        <div className="cns-header">
          <span className="cns-brand">cerbyl</span>
          <button className="cns-close-btn" onClick={handleClose} aria-label="Close navigation">
            <X size={17} />
          </button>
        </div>

        <div className="cns-pfp-wrap">
          <div className="cns-pfp-ring">
            {profilePhoto ? (
              <img src={profilePhoto} alt={displayName} className="cns-pfp-img" referrerPolicy="no-referrer" />
            ) : (
              <div className="cns-pfp-fallback">{initial}</div>
            )}
            <button className="cns-pfp-edit" onClick={(e) => { e.stopPropagation(); setPfpModalOpen(true); }} aria-label="Edit profile picture">
              <Pencil size={10} /> Edit PFP
            </button>
          </div>
          <button className="cns-user-chip" onClick={() => { handleNav('/profile'); }}>
            <div className="cns-user-name">{displayName}</div>
            <div className="cns-user-sub">View Profile →</div>
          </button>
        </div>

        <div className="cns-body">
          <div className="cns-nav-view">
            <div className="cns-quick">
              {QUICK_SECTIONS.map(s => (
                <div key={s.label} className="cns-quick-item" onClick={() => handleNav(s.route)}>
                  <span className="cns-dot" />
                  <span className="cns-quick-label">{s.label}</span>
                  <button className="cns-plus-btn" onClick={(e) => { e.stopPropagation(); handleNav(s.route); }} aria-label={`Open ${s.label}`}>
                    <Plus size={11} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>

            <div className="cns-search">
              <Search size={13} />
              <input
                type="text"
                placeholder="Search modules..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="cns-search-input"
              />
              {searchQuery && (
                <button className="cns-search-clear" onClick={() => setSearchQuery('')}><X size={11} /></button>
              )}
            </div>

            <nav className="cns-nav-groups">
              {filteredGroups.map(g => (
                <div key={g.label} className="cns-nav-group">
                  <div className="cns-group-label">{g.label}</div>
                  {g.links.map(l => (
                    <button
                      key={l.route}
                      className={`cns-nav-link ${location.pathname === l.route ? 'cns-nav-link--active' : ''}`}
                      onClick={() => handleNav(l.route)}
                    >
                      <span className="cns-nav-dot" />
                      {l.label}
                    </button>
                  ))}
                </div>
              ))}
            </nav>
          </div>
        </div>

        <div className="cns-footer">
          <button className="cns-logout-btn" onClick={handleLogout}>
            <LogOut size={14} />
            LOGOUT
          </button>
        </div>
      </aside>

      {pfpModalOpen && (
        <div className="cns-pfp-modal-overlay" onClick={() => setPfpModalOpen(false)}>
          <div className="cns-pfp-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="cns-pfp-modal-head">
              <div>
                <div className="cns-pfp-modal-kicker">PROFILE PERSONALIZATION</div>
                <h3 className="cns-pfp-modal-title">Select Your PFP</h3>
              </div>
              <button className="cns-pfp-modal-close" onClick={() => setPfpModalOpen(false)}><X size={15} /></button>
            </div>
            <div className="cns-pfp-grid">
              <button className={`cns-pfp-card ${!activeCustomPfp ? 'cns-pfp-card--active' : ''}`} onClick={selectDefaultPfp}>
                <div className="cns-pfp-card-media">
                  {defaultUserPfp
                    ? <img src={defaultUserPfp} alt="Default" className="cns-pfp-card-img" referrerPolicy="no-referrer" />
                    : <div className="cns-pfp-card-fallback">{initial}</div>
                  }
                </div>
                <div className="cns-pfp-card-label">Default</div>
                {!activeCustomPfp && <span className="cns-pfp-card-check"><Check size={11} /></span>}
              </button>
              {PRESET_PFPS.map(preset => (
                <button
                  key={preset.id}
                  className={`cns-pfp-card ${activeCustomPfp === preset.src ? 'cns-pfp-card--active' : ''}`}
                  onClick={() => selectPresetPfp(preset.src)}
                >
                  <div className="cns-pfp-card-media">
                    <img src={preset.src} alt={preset.label} className="cns-pfp-card-img" />
                  </div>
                  <div className="cns-pfp-card-label">{preset.label}</div>
                  {activeCustomPfp === preset.src && <span className="cns-pfp-card-check"><Check size={11} /></span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CerbylNavSidebar;
