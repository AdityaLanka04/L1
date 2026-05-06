import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, Pencil } from 'lucide-react';
import { API_URL } from '../config';
import './ProfileNew.css';

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
  return { ...p, firstName: p.firstName || resolvedName, first_name: p.first_name || resolvedName, defaultPfp, customPfp, picture: activePfp, picture_url: activePfp };
};

const ALL_SUBJECTS = [
  'Mathematics','Physics','Chemistry','Biology','Computer Science',
  'History','Geography','Literature','Languages','Art',
  'Music','Economics','Business','Psychology','Philosophy',
  'Engineering','Medicine','Law','Political Science','Sociology'
];

const BRAINWAVE_GOALS = {
  exam_prep: 'Exam Preparation', homework_help: 'Homework Assistance',
  concept_mastery: 'Master Concepts', skill_building: 'Build Skills',
  career_prep: 'Career Development', curiosity: 'Learn for Fun'
};

const ARCHETYPE_INFO = {
  Logicor: { tagline: 'The Systematic Thinker', desc: 'You excel at logical analysis and breaking down complex problems.' },
  Flowist: { tagline: 'The Dynamic Learner', desc: 'You thrive through hands-on experiences and adapt easily to new challenges.' },
  Kinetiq: { tagline: 'The Movement Master', desc: 'You learn best through physical engagement and kinesthetic experiences.' },
  Synth: { tagline: 'The Pattern Connector', desc: 'You naturally see connections and integrate knowledge across domains.' },
  Dreamweaver: { tagline: 'The Visionary', desc: 'You think in possibilities and excel with visual and imaginative approaches.' },
  Anchor: { tagline: 'The Structured Strategist', desc: 'You value organization and thrive with clear systems and methodical approaches.' },
  Spark: { tagline: 'The Creative Innovator', desc: 'You\'re driven by creativity and love exploring novel ideas and methods.' },
  Empathion: { tagline: 'The Empathetic Learner', desc: 'You connect deeply with meaning and understand through emotional intelligence.' },
  Seeker: { tagline: 'The Curious Explorer', desc: 'You\'re motivated by discovery and love expanding your knowledge horizons.' },
  Resonant: { tagline: 'The Adaptive Mind', desc: 'You\'re highly flexible and tune into different learning environments effortlessly.' }
};

const GeoBackground = () => (
  <div className="pn-bg" aria-hidden="true">
    <div className="pn-orb pn-orb-1" />
    <div className="pn-orb pn-orb-2" />
    <div className="pn-orb pn-orb-3" />
    <div className="pn-dots" />
    <svg className="pn-geo" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      {/* Large arc rings */}
      <circle cx="-40" cy="420" r="380" fill="none" strokeWidth="0.6" opacity="0.18" />
      <circle cx="-40" cy="420" r="520" fill="none" strokeWidth="0.3" opacity="0.1" />
      <circle cx="1480" cy="460" r="340" fill="none" strokeWidth="0.5" opacity="0.16" />
      <circle cx="1480" cy="460" r="480" fill="none" strokeWidth="0.25" opacity="0.09" />

      {/* Mid decorative circles */}
      <circle cx="720" cy="-30" r="110" fill="none" strokeWidth="0.5" opacity="0.22" />
      <circle cx="720" cy="-30" r="180" fill="none" strokeWidth="0.25" opacity="0.12" />
      <circle cx="1100" cy="820" r="90" fill="none" strokeWidth="0.4" opacity="0.2" />

      {/* Diamond */}
      <rect x="960" y="160" width="90" height="90" fill="none" strokeWidth="0.5" opacity="0.22"
        transform="rotate(45 1005 205)" />
      <rect x="960" y="160" width="130" height="130" fill="none" strokeWidth="0.25" opacity="0.12"
        transform="rotate(45 1005 205) translate(-20 -20)" />

      {/* Grid lines — horizontal */}
      <line x1="0" y1="220" x2="1440" y2="220" strokeWidth="0.3" opacity="0.1" strokeDasharray="3 14" />
      <line x1="0" y1="450" x2="1440" y2="450" strokeWidth="0.3" opacity="0.1" strokeDasharray="3 14" />
      <line x1="0" y1="680" x2="1440" y2="680" strokeWidth="0.3" opacity="0.1" strokeDasharray="3 14" />

      {/* Grid lines — vertical */}
      <line x1="360" y1="0" x2="360" y2="900" strokeWidth="0.3" opacity="0.1" strokeDasharray="3 14" />
      <line x1="720" y1="0" x2="720" y2="900" strokeWidth="0.3" opacity="0.1" strokeDasharray="3 14" />
      <line x1="1080" y1="0" x2="1080" y2="900" strokeWidth="0.3" opacity="0.1" strokeDasharray="3 14" />

      {/* Diagonal accent lines */}
      <line x1="200" y1="0" x2="600" y2="450" strokeWidth="0.4" opacity="0.12" />
      <line x1="1240" y1="900" x2="900" y2="450" strokeWidth="0.4" opacity="0.1" />

      {/* Cross markers at grid intersections */}
      {[[360,220],[720,220],[1080,220],[360,450],[720,450],[1080,450],[360,680],[720,680],[1080,680]].map(([x,y],i) => (
        <g key={i} opacity="0.28">
          <line x1={x-5} y1={y} x2={x+5} y2={y} strokeWidth="0.6" />
          <line x1={x} y1={y-5} x2={x} y2={y+5} strokeWidth="0.6" />
        </g>
      ))}

      {/* Corner bracket marks */}
      <g opacity="0.2">
        <polyline points="40,40 40,20 60,20" fill="none" strokeWidth="0.8" />
        <polyline points="1400,40 1400,20 1380,20" fill="none" strokeWidth="0.8" />
        <polyline points="40,860 40,880 60,880" fill="none" strokeWidth="0.8" />
        <polyline points="1400,860 1400,880 1380,880" fill="none" strokeWidth="0.8" />
      </g>

      {/* Axis tick labels along bottom edge */}
      <g className="pn-geo-nums" opacity="0.22" fontSize="9" fontFamily="'Inter', monospace" letterSpacing="0.05em">
        <text x="354" y="895">0.25</text>
        <text x="714" y="895">0.50</text>
        <text x="1074" y="895">0.75</text>
      </g>

      {/* Axis tick labels along right edge */}
      <g className="pn-geo-nums" opacity="0.22" fontSize="9" fontFamily="'Inter', monospace" letterSpacing="0.05em">
        <text x="1398" y="224">0.24</text>
        <text x="1398" y="454">0.50</text>
        <text x="1398" y="684">0.75</text>
      </g>

      {/* Floating coordinate labels */}
      <g className="pn-geo-nums" opacity="0.18" fontSize="10" fontFamily="'Inter', monospace" letterSpacing="0.04em">
        <text x="80" y="135">0.482</text>
        <text x="560" y="320">−1.337</text>
        <text x="890" y="110">2.094</text>
        <text x="1200" y="310">0.707</text>
        <text x="160" y="660">3.1416</text>
        <text x="1050" y="580">−0.892</text>
        <text x="640" y="810">1.618</text>
        <text x="320" y="380">0.071</text>
        <text x="820" y="570">−2.190</text>
        <text x="1280" y="720">0.333</text>
      </g>

      {/* Small dot nodes at key points */}
      {[[360,220],[720,450],[1080,220],[360,680],[1080,680]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r="2" opacity="0.3" />
      ))}

      {/* Connected node lines */}
      <line x1="360" y1="220" x2="720" y2="450" strokeWidth="0.4" opacity="0.12" strokeDasharray="2 8" />
      <line x1="720" y1="450" x2="1080" y2="220" strokeWidth="0.4" opacity="0.12" strokeDasharray="2 8" />
      <line x1="360" y1="680" x2="1080" y2="680" strokeWidth="0.4" opacity="0.1" strokeDasharray="2 8" />

      {/* Index labels */}
      <g className="pn-geo-nums" opacity="0.14" fontSize="60" fontFamily="'Inter', sans-serif" fontWeight="800" letterSpacing="-0.03em">
        <text x="30" y="200" transform="rotate(-90 80 180)">01</text>
        <text x="1370" y="580">02</text>
      </g>
    </svg>
    <div className="pn-vignette" />
  </div>
);

const ProfileNew = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('username') || '';

  const [pfp, setPfp] = useState(() => {
    const raw = localStorage.getItem('userProfile');
    if (!raw) return hydrateProfile({}, userName);
    try { return hydrateProfile(JSON.parse(raw), userName); } catch (e) { return hydrateProfile({}, userName); }
  });
  const [pfpModalOpen, setPfpModalOpen] = useState(false);

  const [profileData, setProfileData] = useState({
    firstName: '', lastName: '', email: '',
    fieldOfStudy: '', brainwaveGoal: '',
    preferredSubjects: [],
    primaryArchetype: '', secondaryArchetype: '',
    archetypeDescription: '', archetypeScores: {},
    showStudyInsights: true, notificationsEnabled: true
  });
  const [quizAnswers, setQuizAnswers] = useState({});
  const [dataLoaded, setDataLoaded] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const lastSavedRef = useRef(null);
  const saveTimerRef = useRef(null);
  const isSavingRef = useRef(false);

  const [typedName, setTypedName] = useState('');
  const [nameDone, setNameDone] = useState(false);

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    if (userName) loadProfile();
  }, []);

  const displayName = profileData.firstName || pfp?.firstName || pfp?.first_name
    || localStorage.getItem(DISPLAY_NAME_KEY)
    || (userName ? userName.split('@')[0] : 'Profile');
  const initial = (displayName[0] || 'A').toUpperCase();
  const profilePhoto = pfp?.picture || pfp?.picture_url || '';
  const activeCustomPfp = pfp?.customPfp || '';
  const defaultUserPfp = pfp?.defaultPfp || '';

  useEffect(() => {
    const full = String(displayName || '').trim();
    if (!full) { setTypedName(''); setNameDone(true); return; }
    setTypedName(''); setNameDone(false);
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setTypedName(full.slice(0, i));
      if (i >= full.length) { clearInterval(t); setNameDone(true); }
    }, 80);
    return () => clearInterval(t);
  }, [displayName]);

  const loadProfile = async () => {
    try {
      const resp = await fetch(`${API_URL}/get_comprehensive_profile?user_id=${userName}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (resp.ok) {
        const data = await resp.json();
        const newData = {
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          fieldOfStudy: data.fieldOfStudy || '',
          brainwaveGoal: data.brainwaveGoal || '',
          preferredSubjects: data.preferredSubjects || [],
          primaryArchetype: data.primaryArchetype || '',
          secondaryArchetype: data.secondaryArchetype || '',
          archetypeDescription: data.archetypeDescription || '',
          archetypeScores: (() => {
            try { return typeof data.archetypeScores === 'string' ? JSON.parse(data.archetypeScores) : (data.archetypeScores || {}); }
            catch (e) { return {}; }
          })(),
          showStudyInsights: data.showStudyInsights !== false,
          notificationsEnabled: data.notificationsEnabled !== false,
        };
        setProfileData(newData);
        lastSavedRef.current = JSON.stringify(newData);
        if (data.quizResponses) {
          try { setQuizAnswers(typeof data.quizResponses === 'string' ? JSON.parse(data.quizResponses) : data.quizResponses); }
          catch (e) {}
        }
        localStorage.setItem('userProfile', JSON.stringify(newData));
      }
    } catch (e) {}
    setDataLoaded(true);
    setLastSaved(new Date().toLocaleTimeString());
  };

  const autoSave = useCallback(async (data) => {
    if (isSavingRef.current) return;
    const snapshot = JSON.stringify(data);
    if (snapshot === lastSavedRef.current) return;
    isSavingRef.current = true;
    setAutoSaving(true);
    try {
      const resp = await fetch(`${API_URL}/update_comprehensive_profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...data, user_id: userName })
      });
      if (resp.ok) {
        lastSavedRef.current = snapshot;
        setLastSaved(new Date().toLocaleTimeString());
        localStorage.setItem('userProfile', snapshot);
      }
    } catch (e) {}
    isSavingRef.current = false;
    setAutoSaving(false);
  }, [token, userName]);

  useEffect(() => {
    if (!dataLoaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const snapshot = JSON.stringify(profileData);
    if (snapshot === lastSavedRef.current) return;
    saveTimerRef.current = setTimeout(() => autoSave(profileData), 3000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [profileData, dataLoaded]);

  const setField = (field, value) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
    if (field === 'showStudyInsights' || field === 'notificationsEnabled') {
      const cp = localStorage.getItem('userProfile');
      if (cp) {
        try { const p = JSON.parse(cp); p[field] = value; localStorage.setItem('userProfile', JSON.stringify(p)); } catch (e) {}
      }
      try { window.dispatchEvent(new Event('notification-settings-changed')); } catch (e) {}
    }
  };

  const toggleSubject = (s) => setField('preferredSubjects',
    profileData.preferredSubjects.includes(s)
      ? profileData.preferredSubjects.filter(x => x !== s)
      : [...profileData.preferredSubjects, s]
  );

  const savePfp = (next) => {
    let base = {};
    const raw = localStorage.getItem('userProfile');
    if (raw) try { base = JSON.parse(raw) || {}; } catch (e) {}
    const merged = hydrateProfile({ ...base, ...next }, userName);
    setPfp(merged);
    localStorage.setItem('userProfile', JSON.stringify(merged));
    if (merged.defaultPfp) localStorage.setItem(PFP_DEFAULT_KEY, merged.defaultPfp);
    if (merged.customPfp) localStorage.setItem(PFP_CUSTOM_KEY, merged.customPfp);
    else localStorage.removeItem(PFP_CUSTOM_KEY);
    if (merged.firstName) localStorage.setItem(DISPLAY_NAME_KEY, merged.firstName);
  };

  const selectPreset = (src) => {
    const cur = pfp || {};
    const def = cur.defaultPfp || cur.googlePicture || cur.photoURL || cur.photo_url
      || (isPresetPfp(cur.picture_url || cur.picture || '') ? '' : (cur.picture_url || cur.picture || '')) || '';
    savePfp({ ...cur, defaultPfp: def, customPfp: src, picture: src, picture_url: src });
    setPfpModalOpen(false);
  };

  const selectDefault = () => {
    const cur = pfp || {};
    const def = cur.defaultPfp || cur.googlePicture || cur.photoURL || cur.photo_url
      || (isPresetPfp(cur.picture_url || cur.picture || '') ? '' : (cur.picture_url || cur.picture || '')) || '';
    savePfp({ ...cur, defaultPfp: def, customPfp: '', picture: def, picture_url: def });
    setPfpModalOpen(false);
  };

  useEffect(() => {
    if (!pfpModalOpen) return;
    const fn = (e) => { if (e.key === 'Escape') setPfpModalOpen(false); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [pfpModalOpen]);

  const arch = profileData.primaryArchetype ? ARCHETYPE_INFO[profileData.primaryArchetype] : null;
  const archSecondary = profileData.secondaryArchetype ? ARCHETYPE_INFO[profileData.secondaryArchetype] : null;

  const QUIZ_LABELS = {
    learningEnvironment: 'Learning Environment', problemSolving: 'Problem Solving',
    newConcepts: 'New Concepts', informationProcessing: 'Information Processing',
    feedback: 'Feedback Preference', studyPreference: 'Study Preference',
    challengeResponse: 'Challenge Response', contentType: 'Content Type'
  };
  const ANSWER_LABELS = {
    structured: 'Structured & Organized', flexible: 'Flexible & Adaptive',
    collaborative: 'Collaborative', independent: 'Independent',
    break_down: 'Break Into Steps', visualize: 'Visualize Big Picture',
    experiment: 'Hands-on Experimentation', discuss: 'Discussion & Dialogue',
    reading: 'Reading & Text', visual: 'Visual & Diagrams',
    hands_on: 'Hands-on Practice', discussion: 'Discussion',
    logic: 'Logical Analysis', patterns: 'Pattern Recognition',
    emotion: 'Emotional Connection', action: 'Physical Action',
    detailed: 'Detailed Analysis', encouraging: 'Encouraging',
    constructive: 'Constructive', direct: 'Direct & Concise'
  };

  if (!dataLoaded) {
    return (
      <div className="pn-root">
        <GeoBackground />
        <div className="pn-loading">
          <span className="pn-loading-dot" /><span className="pn-loading-dot" /><span className="pn-loading-dot" />
        </div>
      </div>
    );
  }

  return (
    <div className="pn-root">
      <GeoBackground />

      <div className="pn-topbar">
        <button className="pn-back-btn" onClick={() => navigate('/dashboard')}>
          ← Dashboard
        </button>
        <div className="pn-topbar-center">profile</div>
        <div className="pn-save-status">
          {autoSaving ? (
            <span className="pn-saving">saving<span className="pn-saving-dots"><i/><i/><i/></span></span>
          ) : lastSaved ? (
            <span className="pn-saved">· saved {lastSaved}</span>
          ) : null}
        </div>
      </div>

      <div className="pn-wrap">

        {/* Hero */}
        <section className="pn-hero">
          <div className="pn-hero-text">
            <div className="pn-eyebrow">YOUR PROFILE</div>
            <h1 className="pn-name">
              {nameDone ? displayName : typedName}
              {!nameDone && <span className="pn-cursor" aria-hidden />}
              {nameDone && <span className="pn-period">.</span>}
            </h1>
            {arch && (
              <div className="pn-hero-badges">
                <span className="pn-badge">{profileData.primaryArchetype}</span>
                {profileData.secondaryArchetype && <span className="pn-badge pn-badge--ghost">{profileData.secondaryArchetype}</span>}
              </div>
            )}
          </div>
          <div className="pn-pfp-wrap">
            <div className="pn-pfp-ring">
              {profilePhoto ? (
                <img src={profilePhoto} alt={displayName} className="pn-pfp-img" referrerPolicy="no-referrer" />
              ) : (
                <div className="pn-pfp-fallback">{initial}</div>
              )}
              <button className="pn-pfp-edit-btn" onClick={() => setPfpModalOpen(true)} aria-label="Edit profile picture">
                <Pencil size={13} /> Edit PFP
              </button>
            </div>
          </div>
        </section>

        {/* Archetype */}
        {profileData.primaryArchetype ? (
          <section className="pn-section">
            <div className="pn-section-label">LEARNING ARCHETYPE</div>
            <div className="pn-archetype-grid">
              <div className="pn-archetype-main">
                <div className="pn-arch-tag">PRIMARY</div>
                <div className="pn-arch-name">{profileData.primaryArchetype}</div>
                <div className="pn-arch-tagline">{arch?.tagline}</div>
                <p className="pn-arch-desc">{arch?.desc}</p>
                {profileData.secondaryArchetype && (
                  <div className="pn-arch-secondary">
                    <span className="pn-arch-secondary-tag">SECONDARY</span>
                    <span className="pn-arch-secondary-name">{profileData.secondaryArchetype}</span>
                    <span className="pn-arch-secondary-sub">{archSecondary?.tagline}</span>
                  </div>
                )}
                <button className="pn-retake-btn" onClick={() => navigate('/profile-quiz')}>
                  Retake Assessment →
                </button>
              </div>
              {Object.keys(profileData.archetypeScores).length > 0 && (
                <div className="pn-archetype-bars">
                  <div className="pn-bars-label">BREAKDOWN</div>
                  {Object.entries(profileData.archetypeScores)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 6)
                    .map(([name, score]) => (
                      <div key={name} className="pn-bar-row">
                        <span className="pn-bar-name">{name}</span>
                        <div className="pn-bar-track">
                          <div className="pn-bar-fill" style={{ width: `${score}%` }} />
                        </div>
                        <span className="pn-bar-pct">{Math.round(score)}%</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="pn-section">
            <div className="pn-section-label">LEARNING ARCHETYPE</div>
            <button className="pn-discover-btn" onClick={() => navigate('/profile-quiz')}>
              <span className="pn-discover-title">Discover Your Learning Archetype</span>
              <span className="pn-discover-sub">Take our assessment to unlock personalized AI tutoring tailored to your style →</span>
            </button>
          </section>
        )}

        <div className="pn-divider" />

        {/* Personal Info + Goals row */}
        <div className="pn-two-col">
          <section className="pn-section">
            <div className="pn-section-label">PERSONAL INFO</div>
            <div className="pn-field-row">
              <div className="pn-field">
                <label className="pn-field-label">First Name</label>
                <input className="pn-input" value={profileData.firstName} onChange={e => setField('firstName', e.target.value)} placeholder="First name" />
              </div>
              <div className="pn-field">
                <label className="pn-field-label">Last Name</label>
                <input className="pn-input" value={profileData.lastName} onChange={e => setField('lastName', e.target.value)} placeholder="Last name" />
              </div>
            </div>
            <div className="pn-field pn-field--full">
              <label className="pn-field-label">Email Address</label>
              <input className="pn-input" type="email" value={profileData.email} onChange={e => setField('email', e.target.value)} placeholder="your@email.com" />
            </div>
          </section>

          <section className="pn-section">
            <div className="pn-section-label">LEARNING GOALS</div>
            <div className="pn-field pn-field--full">
              <label className="pn-field-label">Main Subject</label>
              <select className="pn-select" value={profileData.fieldOfStudy} onChange={e => setField('fieldOfStudy', e.target.value)}>
                <option value="">Select your main subject</option>
                {ALL_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="pn-field pn-field--full">
              <label className="pn-field-label">Primary Goal</label>
              <select className="pn-select" value={profileData.brainwaveGoal} onChange={e => setField('brainwaveGoal', e.target.value)}>
                <option value="">Select your goal</option>
                {Object.entries(BRAINWAVE_GOALS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </section>
        </div>

        <div className="pn-divider" />

        {/* Interests */}
        <section className="pn-section">
          <div className="pn-section-label">INTERESTED SUBJECTS</div>
          <div className="pn-subjects-grid">
            {ALL_SUBJECTS.map(s => (
              <button
                key={s}
                className={`pn-chip ${profileData.preferredSubjects.includes(s) ? 'pn-chip--on' : ''}`}
                onClick={() => toggleSubject(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        <div className="pn-divider" />

        {/* Settings */}
        <section className="pn-section">
          <div className="pn-section-label">SETTINGS</div>
          <div className="pn-settings-grid">
            <div className="pn-setting-row">
              <div className="pn-setting-info">
                <span className="pn-setting-label">Study Insights on Login</span>
                <span className="pn-setting-desc">Display study insights page when you first log in each day</span>
              </div>
              <button
                className={`pn-toggle ${profileData.showStudyInsights ? 'pn-toggle--on' : ''}`}
                onClick={() => setField('showStudyInsights', !profileData.showStudyInsights)}
                role="switch" aria-checked={profileData.showStudyInsights}
              >
                <span className="pn-toggle-thumb" />
              </button>
            </div>
            <div className="pn-setting-row">
              <div className="pn-setting-info">
                <span className="pn-setting-label">Enable Notifications</span>
                <span className="pn-setting-desc">Show notification popups and unread badges across the app</span>
              </div>
              <button
                className={`pn-toggle ${profileData.notificationsEnabled ? 'pn-toggle--on' : ''}`}
                onClick={() => setField('notificationsEnabled', !profileData.notificationsEnabled)}
                role="switch" aria-checked={profileData.notificationsEnabled}
              >
                <span className="pn-toggle-thumb" />
              </button>
            </div>
          </div>
        </section>

        {/* Quiz Responses */}
        {Object.keys(quizAnswers).length > 0 && (
          <>
            <div className="pn-divider" />
            <section className="pn-section">
              <div className="pn-section-label">ASSESSMENT RESPONSES</div>
              <div className="pn-quiz-grid">
                {Object.entries(quizAnswers).map(([q, a]) => (
                  <div key={q} className="pn-quiz-item">
                    <span className="pn-quiz-q">{QUIZ_LABELS[q] || q}</span>
                    <span className="pn-quiz-a">{ANSWER_LABELS[a] || a}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <div className="pn-bottom-gap" />
      </div>

      {/* PFP Modal */}
      {pfpModalOpen && (
        <div className="pn-modal-overlay" onClick={() => setPfpModalOpen(false)}>
          <div className="pn-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="pn-modal-head">
              <div>
                <div className="pn-modal-kicker">PROFILE PERSONALIZATION</div>
                <h3 className="pn-modal-title">Select Your PFP</h3>
              </div>
              <button className="pn-modal-close" onClick={() => setPfpModalOpen(false)}><X size={15} /></button>
            </div>
            <div className="pn-pfp-grid">
              <button className={`pn-pfp-card ${!activeCustomPfp ? 'pn-pfp-card--active' : ''}`} onClick={selectDefault}>
                <div className="pn-pfp-card-media">
                  {defaultUserPfp
                    ? <img src={defaultUserPfp} alt="Default" className="pn-pfp-card-img" referrerPolicy="no-referrer" />
                    : <div className="pn-pfp-card-fallback">{initial}</div>}
                </div>
                <div className="pn-pfp-card-label">Default</div>
                {!activeCustomPfp && <span className="pn-pfp-card-check"><Check size={11} /></span>}
              </button>
              {PRESET_PFPS.map(p => (
                <button key={p.id} className={`pn-pfp-card ${activeCustomPfp === p.src ? 'pn-pfp-card--active' : ''}`} onClick={() => selectPreset(p.src)}>
                  <div className="pn-pfp-card-media">
                    <img src={p.src} alt={p.label} className="pn-pfp-card-img" />
                  </div>
                  <div className="pn-pfp-card-label">{p.label}</div>
                  {activeCustomPfp === p.src && <span className="pn-pfp-card-check"><Check size={11} /></span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileNew;
