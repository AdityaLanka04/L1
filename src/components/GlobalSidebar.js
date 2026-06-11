import { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Pencil, X, Check, Search, LogOut, ChevronLeft, ChevronRight,
  LayoutDashboard, MessageSquare, Layers, FileText, Mic, HelpCircle,
  Presentation, Database, ListChecks, Target, AlertTriangle, Swords,
  BarChart3, Map, Network, Activity, Route, ListMusic, Users, Trophy,
  Gamepad2, UserPlus, ShieldCheck, KeyRound, User
} from 'lucide-react';
import './GlobalSidebar.css';

const PRESET_PFPS = [
  { id: 'cat', label: 'Cat', src: '/pfp/cat.png' },
  { id: 'woman', label: 'Woman', src: '/pfp/woman.png' }
];
const isPresetPfp = (src) => PRESET_PFPS.some(p => p.src === src);
const PFP_DEFAULT_KEY = 'cerbyl.defaultPfp';
const PFP_CUSTOM_KEY = 'cerbyl.customPfp';
const DISPLAY_NAME_KEY = 'cerbyl.displayName';

const getStoredUserEmail = () => {
  let email = localStorage.getItem('email') || localStorage.getItem('username') || '';
  try {
    const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    email = profile.email || email;
  } catch (error) {
    // Ignore malformed local profile data.
  }
  return email;
};

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
      { label: 'Dashboard', route: '/dashboard-cerbyl', icon: LayoutDashboard },
      { label: 'Search Hub', route: '/search-hub', icon: Search },
    ]
  },
  {
    label: 'LEARNING',
    links: [
      { label: 'AI Chat', route: '/ai-chat', icon: MessageSquare },
      { label: 'Flashcards', route: '/flashcards', icon: Layers },
      { label: 'Notes', route: '/notes', icon: FileText },
      { label: 'Media Notes', route: '/notes/ai-media', icon: Mic },
      { label: 'Quiz Hub', route: '/quiz-hub', icon: HelpCircle },
      { label: 'Slide Explorer', route: '/slide-explorer', icon: Presentation },
      { label: 'ContextHub', route: '/contexthub', icon: Database },
    ]
  },
  {
    label: 'PRACTICE',
    links: [
      { label: 'Question Bank', route: '/question-bank', icon: ListChecks },
      { label: 'Solo Quiz', route: '/solo-quiz', icon: Target },
      { label: 'Weak Areas', route: '/weaknesses', icon: AlertTriangle },
      { label: 'Challenges', route: '/challenges', icon: Swords },
    ]
  },
  {
    label: 'PROGRESS',
    links: [
      { label: 'Analytics', route: '/analytics', icon: BarChart3 },
      { label: 'XP Roadmap', route: '/xp-roadmap', icon: Map },
      { label: 'Knowledge Map', route: '/knowledge-map', icon: Network },
      { label: 'Activity Timeline', route: '/activity-timeline', icon: Activity },
      { label: 'Learning Paths', route: '/learning-paths', icon: Route },
      { label: 'Playlists', route: '/playlists', icon: ListMusic },
    ]
  },
  {
    label: 'SOCIAL',
    links: [
      { label: 'Social Hub', route: '/social', icon: Users },
      { label: 'Leaderboards', route: '/leaderboards', icon: Trophy },
      { label: 'Games', route: '/games', icon: Gamepad2 },
      { label: 'Friends', route: '/friends', icon: UserPlus },
    ]
  },
];

const COLLAPSED_SHORTCUTS = [
  { label: 'Dashboard', route: '/dashboard-cerbyl', icon: LayoutDashboard },
  { label: 'Search Hub', route: '/search-hub', icon: Search },
  { label: 'AI Chat', route: '/ai-chat', icon: MessageSquare },
  { label: 'Notes', route: '/notes', icon: FileText },
  { label: 'Flashcards', route: '/flashcards', icon: Layers },
  { label: 'Quiz Hub', route: '/quiz-hub', icon: HelpCircle },
];

const MOBILE_QUERY = '(max-width: 860px)';

const GlobalSidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [expanded, setExpanded] = useState(true);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  );
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
    const mq = window.matchMedia(MOBILE_QUERY);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useLayoutEffect(() => {
    const width = isMobile ? '0px' : (expanded ? '288px' : '88px');
    document.documentElement.style.setProperty('--gnav-width', width);
  }, [expanded, isMobile]);

  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => setSearchQuery(''), 280);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!pfpModalOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setPfpModalOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pfpModalOpen]);

  const savePfpProfile = (nextProfile) => {
    let base = {};
    const raw = localStorage.getItem('userProfile');
    if (raw) try { base = JSON.parse(raw) || {}; } catch (e) { /* silenced */ }
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

  const handleNav = (route) => {
    navigate(route);
    if (isMobile) onClose?.();
  };

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    navigate('/login');
    if (isMobile) onClose?.();
  };

  const userEmail = getStoredUserEmail();
  const isAdmin = ['aditya.s.lanka@gmail.com', 'asphar057@gmail.com'].includes(userEmail);
  const canViewApiUsage = ['aditya.s.lanka@gmail.com', 'rithvikkumar35@gmail.com'].includes(userEmail);
  const adminLinks = [
    { label: 'Analytics Dashboard', route: '/admin/analytics', icon: ShieldCheck },
    ...(canViewApiUsage ? [{ label: 'API Key Usage', route: '/admin/api-usage', icon: KeyRound }] : []),
  ];
  const allGroups = isAdmin || canViewApiUsage
    ? [...NAV_GROUPS, { label: 'ADMIN', links: adminLinks }]
    : NAV_GROUPS;

  const filteredGroups = searchQuery
    ? allGroups.map(g => ({
        ...g,
        links: g.links.filter(l => l.label.toLowerCase().includes(searchQuery.toLowerCase()))
      })).filter(g => g.links.length > 0)
    : allGroups;

  const showCollapsedStrip = !isMobile && !expanded;

  let sidebarClass = 'gnav-sidebar';
  if (isMobile) {
    sidebarClass += isOpen ? ' gnav-sidebar--mobile gnav-sidebar--mobile-open' : ' gnav-sidebar--mobile';
  } else if (!expanded) {
    sidebarClass += ' gnav-sidebar--collapsed';
  }

  return (
    <>
      {isMobile && (
        <div className={`gnav-backdrop ${isOpen ? 'gnav-backdrop--visible' : ''}`} onClick={onClose} />
      )}

      <aside className={sidebarClass} aria-hidden={isMobile && !isOpen}>
        {showCollapsedStrip ? (
          <div className="gnav-collapsed-strip">
            <button className="gnav-strip-btn" data-tip="Expand sidebar" onClick={() => setExpanded(true)}>
              <ChevronRight size={18} />
            </button>
            {COLLAPSED_SHORTCUTS.map(item => (
              <button
                key={item.route}
                className={`gnav-strip-btn ${location.pathname === item.route ? 'gnav-strip-btn--active' : ''}`}
                data-tip={item.label}
                onClick={() => handleNav(item.route)}
              >
                <item.icon size={18} />
              </button>
            ))}
            <div className="gnav-strip-spacer" />
            <button className="gnav-strip-btn" data-tip="Profile" onClick={() => handleNav('/profile')}>
              <User size={18} />
            </button>
            <button className="gnav-strip-btn" data-tip="Logout" onClick={handleLogout}>
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <>
            <div className="gnav-brand">
              <div className="gnav-brand-wrap">
                <div className="gnav-brand-name">cerbyl</div>
              </div>
              {!isMobile ? (
                <button className="gnav-collapse-btn" onClick={() => setExpanded(false)} aria-label="Collapse sidebar" title="Collapse sidebar">
                  <ChevronLeft size={14} />
                </button>
              ) : (
                <button className="gnav-collapse-btn" onClick={onClose} aria-label="Close navigation" title="Close navigation">
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="gnav-profile">
              <div className="gnav-pfp-ring">
                {profilePhoto ? (
                  <img src={profilePhoto} alt={displayName} className="gnav-pfp-img" referrerPolicy="no-referrer" />
                ) : (
                  <div className="gnav-pfp-fallback">{initial}</div>
                )}
                <button className="gnav-pfp-edit" onClick={(e) => { e.stopPropagation(); setPfpModalOpen(true); }} aria-label="Edit profile picture">
                  <Pencil size={10} /> Edit PFP
                </button>
              </div>
              <button className="gnav-user-chip" onClick={() => handleNav('/profile')}>
                <div className="gnav-user-name">{displayName}</div>
                <div className="gnav-user-sub">View Profile →</div>
              </button>
            </div>

            <div className="gnav-search">
              <Search size={13} />
              <input
                type="text"
                placeholder="Search modules..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="gnav-search-input"
              />
              {searchQuery && (
                <button className="gnav-search-clear" onClick={() => setSearchQuery('')}><X size={11} /></button>
              )}
            </div>

            <nav className="gnav-nav-groups">
              {filteredGroups.map(g => (
                <div key={g.label} className="gnav-nav-group">
                  <div className="gnav-group-label">{g.label}</div>
                  {g.links.map(l => (
                    <button
                      key={l.route}
                      className={`gnav-nav-link ${location.pathname === l.route ? 'gnav-nav-link--active' : ''}`}
                      onClick={() => handleNav(l.route)}
                    >
                      <span className="gnav-nav-icon"><l.icon size={15} /></span>
                      <span>{l.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </nav>

            <div className="gnav-footer">
              <button className="gnav-logout-btn" onClick={handleLogout}>
                <LogOut size={14} />
                LOGOUT
              </button>
            </div>
          </>
        )}
      </aside>

      {pfpModalOpen && (
        <div className="gnav-pfp-modal-overlay" onClick={() => setPfpModalOpen(false)}>
          <div className="gnav-pfp-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="gnav-pfp-modal-head">
              <div>
                <div className="gnav-pfp-modal-kicker">PROFILE PERSONALIZATION</div>
                <h3 className="gnav-pfp-modal-title">Select Your PFP</h3>
              </div>
              <button className="gnav-pfp-modal-close" onClick={() => setPfpModalOpen(false)}><X size={15} /></button>
            </div>
            <div className="gnav-pfp-grid">
              <button className={`gnav-pfp-card ${!activeCustomPfp ? 'gnav-pfp-card--active' : ''}`} onClick={selectDefaultPfp}>
                <div className="gnav-pfp-card-media">
                  {defaultUserPfp
                    ? <img src={defaultUserPfp} alt="Default" className="gnav-pfp-card-img" referrerPolicy="no-referrer" />
                    : <div className="gnav-pfp-card-fallback">{initial}</div>
                  }
                </div>
                <div className="gnav-pfp-card-label">Default</div>
                {!activeCustomPfp && <span className="gnav-pfp-card-check"><Check size={11} /></span>}
              </button>
              {PRESET_PFPS.map(preset => (
                <button
                  key={preset.id}
                  className={`gnav-pfp-card ${activeCustomPfp === preset.src ? 'gnav-pfp-card--active' : ''}`}
                  onClick={() => selectPresetPfp(preset.src)}
                >
                  <div className="gnav-pfp-card-media">
                    <img src={preset.src} alt={preset.label} className="gnav-pfp-card-img" />
                  </div>
                  <div className="gnav-pfp-card-label">{preset.label}</div>
                  {activeCustomPfp === preset.src && <span className="gnav-pfp-card-check"><Check size={11} /></span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalSidebar;
