import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Plus, ChevronRight, FileText, Mic } from 'lucide-react';
import { API_URL } from '../config/api';
import ThemeSwitcher from '../components/ThemeSwitcher';
import logo from '../assets/logo.svg';
import './DashboardCerbyl.css';

const MODULES = [
  { num: '04', label: 'Roadmap',       sub: 'KNOWLEDGE',    route: '/knowledge-roadmap' },
  { num: '05', label: 'Questions',     sub: 'PRACTICE',     route: '/question-bank' },
  { num: '06', label: 'Slides',        sub: 'PRESENT',      route: '/slide-explorer' },
  { num: '07', label: 'Weak Areas',    sub: 'IMPROVE',      route: '/weaknesses' },
  { num: '08', label: 'Social Hub',    sub: 'COMMUNITY',    route: '/social' },
  { num: '09', label: 'Timeline',      sub: 'ACTIVITY LOG', route: '/activity-timeline' },
  { num: '10', label: 'Learning Path', sub: 'PROGRESSION',  route: '/learning-paths' },
  { num: '11', label: 'XP Roadmap',    sub: 'MILESTONES',   route: '/xp-roadmap' },
  { num: '12', label: 'Quiz Hub',      sub: 'CHALLENGE',    route: '/quiz-hub' },
  { num: '13', label: 'Concept Web',   sub: 'NETWORK',      route: '/concept-web' },
  { num: '14', label: 'Playlists',     sub: 'COLLECTIONS',  route: '/playlists' }
];

const SIDE_LINKS = [
  { label: 'Roadmap',           route: '/knowledge-roadmap' },
  { label: 'Questions',         route: '/question-bank' },
  { label: 'Slides',            route: '/slide-explorer' },
  { label: 'Weak Areas',        route: '/weaknesses' },
  { label: 'Social Hub',        route: '/social' },
  { label: 'Activity Timeline', route: '/activity-timeline' },
  { label: 'Learning Path',     route: '/learning-paths' },
  { label: 'XP Roadmap',        route: '/xp-roadmap' }
];

const greetingForHour = (h) => {
  if (h < 5) return 'Good Night';
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  if (h < 21) return 'Good Evening';
  return 'Good Night';
};

const formatDateLong = (d) => {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const fetchJson = async (url) => {
  const token = localStorage.getItem('token');
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

const DAY_LABELS = ['S','M','T','W','T','F','S'];

const DashboardCerbyl = () => {
  const navigate = useNavigate();

  const [userName, setUserName] = useState('');
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({
    streak: 0,
    level: 1,
    xp: 0,
    nextXp: 1000,
    chats: 0,
    notes: 0,
    cards: 0,
    quizzes: 0,
    questions: 0,
    rank: null,
    weeklyPoints: 0
  });
  const [heatmap, setHeatmap] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [now, setNow] = useState(new Date());
  const [recentNotes, setRecentNotes] = useState([]);
  const [recentMedia, setRecentMedia] = useState([]);
  const [recentSets, setRecentSets] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const prof = localStorage.getItem('userProfile');
    if (!token) { navigate('/login'); return; }
    if (username) setUserName(username);
    if (prof) {
      try { setProfile(JSON.parse(prof)); } catch (e) {}
    }
  }, [navigate]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!userName) return;
    let cancelled = false;

    (async () => {
      try {
        const g = await fetchJson(`${API_URL}/get_gamification_stats?user_id=${userName}`);
        if (cancelled) return;
        setStats(prev => ({
          ...prev,
          streak: g.current_streak ?? prev.streak,
          level: g.level ?? prev.level,
          xp: g.experience ?? g.current_xp ?? prev.xp,
          nextXp: g.next_level_xp ?? prev.nextXp,
          chats: g.total_chat_sessions ?? prev.chats,
          notes: g.total_notes_created ?? prev.notes,
          cards: g.total_flashcards_created ?? prev.cards,
          quizzes: g.total_quizzes_completed ?? g.total_quizzes ?? prev.quizzes,
          questions: g.total_questions_answered ?? prev.questions,
          rank: g.rank ?? g.global_rank ?? prev.rank,
          weeklyPoints: g.weekly_points ?? prev.weeklyPoints
        }));
      } catch (e) {}

      try {
        const d = await fetchJson(`${API_URL}/get_dashboard_data?user_id=${userName}`);
        if (cancelled) return;
        const gf = d.gamification || {};
        setStats(prev => ({
          ...prev,
          streak: gf.current_streak ?? prev.streak,
          level: gf.level ?? prev.level,
          xp: gf.experience ?? prev.xp,
          nextXp: gf.next_level_xp ?? prev.nextXp,
          chats: gf.total_chat_sessions ?? prev.chats,
          notes: gf.total_notes_created ?? prev.notes,
          cards: gf.total_flashcards_created ?? prev.cards,
          quizzes: gf.total_quizzes_completed ?? prev.quizzes,
          questions: gf.total_ai_chats ?? prev.questions,
          rank: gf.rank ?? prev.rank,
          weeklyPoints: gf.weekly_points ?? prev.weeklyPoints
        }));
      } catch (e) {}

      try {
        const h = await fetchJson(`${API_URL}/get_activity_heatmap?user_id=${userName}`);
        if (cancelled) return;
        setHeatmap(h.heatmap_data || []);
      } catch (e) {}

      try {
        const a = await fetchJson(`${API_URL}/get_analytics_history?user_id=${userName}&period=week`);
        if (cancelled) return;
        const arr = (a.history || []).map(x => ({
          total: (x.ai_chats || 0) + (x.flashcards || 0) + (x.notes || 0) + (x.quizzes || 0),
          date: x.date
        }));
        const filled = arr.length === 7 ? arr :
          [...Array(7)].map((_, i) => arr[i] || { total: 0, date: '' });
        setWeekly(filled);
      } catch (e) {
        setWeekly([...Array(7)].map(() => ({ total: 0, date: '' })));
      }

      try {
        const n = await fetchJson(`${API_URL}/get_notes?user_id=${userName}`);
        if (cancelled) return;
        const list = Array.isArray(n) ? n : (n.notes || []);
        setRecentNotes(list.slice(0, 3));
      } catch (e) {}

      try {
        const m = await fetchJson(`${API_URL}/media/history?user_id=${userName}`);
        if (cancelled) return;
        setRecentMedia((m.history || []).slice(0, 2));
      } catch (e) {}

      try {
        const fc = await fetchJson(`${API_URL}/get_flashcards?user_id=${userName}`);
        if (cancelled) return;
        const seen = new Map();
        for (const card of (Array.isArray(fc) ? fc : [])) {
          if (!card.set_id) continue;
          if (!seen.has(card.set_id)) {
            seen.set(card.set_id, {
              set_id: card.set_id,
              title: card.set_title || 'Untitled set',
              created_at: card.created_at,
              count: 0
            });
          }
          seen.get(card.set_id).count++;
        }
        const sets = Array.from(seen.values())
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 3);
        setRecentSets(sets);
      } catch (e) {}
    })();

    return () => { cancelled = true; };
  }, [userName]);

  const greet = greetingForHour(now.getHours()).toUpperCase();
  const displayName = profile?.firstName || profile?.first_name ||
    (userName ? userName.split('@')[0] : 'there');
  const initial = (displayName[0] || 'A').toUpperCase();

  const heatmapWeeks = useMemo(() => {
    if (!heatmap.length) return [];
    const map = new Map();
    heatmap.forEach(d => map.set(d.date, d));
    const last = new Date(heatmap[heatmap.length - 1].date);
    const start = new Date(last);
    start.setDate(last.getDate() - 7 * 24);
    while (start.getDay() !== 0) start.setDate(start.getDate() - 1);
    const weeks = [];
    const cur = new Date(start);
    while (cur <= last) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const key = cur.toISOString().split('T')[0];
        week.push(map.get(key) || { date: key, count: 0, level: 0 });
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
    }
    return weeks;
  }, [heatmap]);

  const weeklyChart = useMemo(() => {
    const w = 320, h = 90, padX = 16, padTop = 14, padBot = 22;
    const innerW = w - padX * 2;
    const innerH = h - padTop - padBot;
    const max = Math.max(1, ...weekly.map(d => d.total));
    const step = innerW / Math.max(1, weekly.length - 1);
    const points = weekly.map((d, i) => {
      const x = padX + i * step;
      const y = padTop + innerH - (d.total / max) * innerH;
      return { x, y, total: d.total, date: d.date };
    });
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const area = points.length
      ? `${path} L ${points[points.length - 1].x.toFixed(1)} ${padTop + innerH} L ${points[0].x.toFixed(1)} ${padTop + innerH} Z`
      : '';
    return { w, h, padX, padTop, padBot, innerH, points, path, area };
  }, [weekly]);

  const xpPct = Math.min(100, stats.nextXp ? (stats.xp / stats.nextXp) * 100 : 0);
  const sessionsTotal = (stats.chats || 0) + (stats.quizzes || 0);
  const pct = (n, d) => d > 0 ? Math.min(100, Math.round((n / d) * 100)) : 0;
  const ringTargets = { chats: 50, notes: 50, cards: 100, quizzes: 50 };

  const todayLabel = (() => {
    const d = new Date();
    const offset = (i) => {
      const x = new Date(d);
      x.setDate(d.getDate() - (6 - i));
      return DAY_LABELS[x.getDay()];
    };
    return [...Array(7)].map((_, i) => offset(i));
  })();

  return (
    <div className="cb-root">
      {/* Background effects (gradient orbs + dot grid) */}
      <div className="cb-bg-fx" aria-hidden>
        <div className="cb-bg-orb cb-bg-orb-1" />
        <div className="cb-bg-orb cb-bg-orb-2" />
        <div className="cb-bg-orb cb-bg-orb-3" />
        <div className="cb-bg-dots" />
        <div className="cb-bg-vignette" />
      </div>

      {/* Top bar */}
      <div className="cb-topbar">
        <div className="cb-tagline">accelerate <span>your learning</span></div>
        <div className="cb-topbar-right">
          <button className="cb-classic-link" onClick={() => navigate('/dashboard')}>
            ← Classic
          </button>
          <div className="cb-date">{formatDateLong(now)}</div>
          <ThemeSwitcher />
        </div>
      </div>

      <div className="cb-shell">
        {/* Sidebar */}
        <aside className="cb-side">
          <div className="cb-brand">
            <span className="cb-brand-name">cerbyl</span>
          </div>

          <div className="cb-logo-wrap" aria-hidden>
            <div className="cb-logo-img" style={{ WebkitMaskImage: `url(${logo})`, maskImage: `url(${logo})` }} />
          </div>

          <div className="cb-side-sections">
            {[
              { label: 'AI Chat',    route: '/ai-chat' },
              { label: 'Flashcards', route: '/flashcards' },
              { label: 'Notes',      route: '/notes' }
            ].map((s) => (
              <div key={s.label} className="cb-side-section" onClick={() => navigate(s.route)}>
                <span className="cb-side-dot" />
                <span className="cb-side-label">{s.label}</span>
                <button
                  className="cb-side-plus"
                  onClick={(e) => { e.stopPropagation(); navigate(s.route); }}
                  aria-label={`Open ${s.label}`}
                >
                  <Plus size={12} strokeWidth={2.4} />
                </button>
              </div>
            ))}
          </div>

          <nav className="cb-side-nav">
            {SIDE_LINKS.map(l => (
              <button
                key={l.label}
                className="cb-side-link"
                onClick={() => navigate(l.route)}
              >
                <span className="cb-side-link-dot" />
                {l.label}
              </button>
            ))}
          </nav>

          <button className="cb-user-chip" onClick={() => navigate('/profile')}>
            <span className="cb-avatar">{initial}</span>
            <span className="cb-user-meta">
              <span className="cb-user-name">{displayName}</span>
              <span className="cb-user-sub">Level {stats.level} · {stats.xp} XP</span>
            </span>
          </button>
        </aside>

        {/* Main */}
        <main className="cb-main">
          {/* Hero */}
          <section className="cb-hero">
            <div className="cb-hero-text">
              <div className="cb-eyebrow">{greet}</div>
              <h1 className="cb-name">{displayName}<span className="cb-period">.</span></h1>
            </div>

            <div className="cb-stat-row">
              <div className="cb-stat">
                <div className="cb-stat-num">{String(stats.level).padStart(2, '0')}</div>
                <div className="cb-stat-lbl">LEVEL</div>
              </div>
              <div className="cb-stat">
                <div className="cb-stat-num">{stats.xp}<span className="cb-stat-tiny"> XP</span></div>
                <div className="cb-stat-lbl">OF {stats.nextXp}</div>
              </div>
              <div className="cb-stat">
                <div className="cb-stat-num">#{stats.rank || 1}</div>
                <div className="cb-stat-lbl">GLOBAL</div>
              </div>
              <div className="cb-stat">
                <div className="cb-stat-num">{stats.streak}</div>
                <div className="cb-stat-lbl">STREAK</div>
              </div>
              <div className="cb-stat">
                <div className="cb-stat-num">{stats.questions}</div>
                <div className="cb-stat-lbl">QUESTIONS</div>
              </div>
              <button className="cb-ai-cta" onClick={() => navigate('/ai-chat')}>
                AI Session <ArrowUpRight size={16} />
              </button>
            </div>

            <div className="cb-xp-track" aria-label={`XP progress ${stats.xp} of ${stats.nextXp}`}>
              <div className="cb-xp-fill" style={{ width: `${xpPct}%` }} />
            </div>
          </section>

          {/* Three feature cards */}
          <section className="cb-features">
            <div className="cb-feat" onClick={() => navigate('/ai-chat')} role="button" tabIndex={0}>
              <div className="cb-feat-tag">AI CHAT</div>
              <div className="cb-feat-title">Ask<br />Anything</div>
              <div className="cb-feat-desc">Instant AI guidance on any topic</div>
              <div className="cb-feat-typing">
                <span className="cb-typing-dots"><i/><i/><i/></span>
                <div className="cb-typing-bubble">Explain quantum</div>
                <div className="cb-typing-input">Quantum mechanics describes…</div>
              </div>
              <span className="cb-feat-arrow"><ArrowUpRight size={16}/></span>
            </div>

            <div className="cb-feat" onClick={() => navigate('/flashcards')} role="button" tabIndex={0}>
              <div className="cb-feat-tag">FLASHCARDS</div>
              <div className="cb-feat-title">Master<br />Any Topic</div>
              <div className="cb-feat-desc">Spaced repetition · AI card sets</div>
              <div className="cb-recent-list">
                {recentSets.length === 0 ? (
                  <div className="cb-recent-empty">No card sets yet. Tap to create one.</div>
                ) : recentSets.map(s => (
                  <div
                    key={s.set_id}
                    className="cb-recent-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/flashcards?set=${s.set_id}`);
                    }}
                  >
                    <span className="cb-recent-icon"><FileText size={12}/></span>
                    <span className="cb-recent-title">{s.title}</span>
                    <span className="cb-recent-meta">{s.count}</span>
                  </div>
                ))}
              </div>
              <span className="cb-feat-arrow"><ArrowUpRight size={16}/></span>
            </div>

            <div className="cb-feat" onClick={() => navigate('/notes')} role="button" tabIndex={0}>
              <div className="cb-feat-tag">NOTES</div>
              <div className="cb-feat-title">Your<br />Knowledge</div>
              <div className="cb-feat-desc">Written notes · AI media notes</div>
              <div className="cb-recent-list">
                {recentNotes.length === 0 && recentMedia.length === 0 ? (
                  <div className="cb-recent-empty">No notes yet. Tap to start writing.</div>
                ) : (
                  <>
                    {recentNotes.slice(0, 2).map(n => (
                      <div
                        key={`n-${n.id}`}
                        className="cb-recent-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/notes/editor/${n.id}`);
                        }}
                      >
                        <span className="cb-recent-icon"><FileText size={12}/></span>
                        <span className="cb-recent-title">{n.title || 'Untitled note'}</span>
                        <span className="cb-recent-meta">note</span>
                      </div>
                    ))}
                    {recentMedia.slice(0, 2).map(m => (
                      <div
                        key={`m-${m.id}`}
                        className="cb-recent-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/notes/ai-media/${m.id}`);
                        }}
                      >
                        <span className="cb-recent-icon"><Mic size={12}/></span>
                        <span className="cb-recent-title">{m.title || 'Media note'}</span>
                        <span className="cb-recent-meta">media</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
              <span className="cb-feat-arrow"><ArrowUpRight size={16}/></span>
            </div>
          </section>

          {/* Modules strip - infinite marquee in accent color */}
          <section className="cb-strip">
            <div className="cb-strip-eyebrow">
              ALL MODULES — HOVER TO PAUSE
            </div>
            <div className="cb-marquee">
              <div className="cb-marquee-track">
                {[...MODULES, ...MODULES].map((m, i) => (
                  <button
                    key={`${m.num}-${i}`}
                    className="cb-mod"
                    onClick={() => navigate(m.route)}
                  >
                    <div className="cb-mod-num">{m.num}</div>
                    <div className="cb-mod-label">{m.label}</div>
                    <div className="cb-mod-sub">{m.sub}</div>
                    <span className="cb-mod-arrow"><ChevronRight size={14}/></span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Top analytics row: 3 panels */}
          <section className="cb-bottom">
            <div className="cb-panel cb-panel--act">
              <div className="cb-panel-head">
                <span className="cb-panel-title">Past Week Activity</span>
                <button className="cb-panel-link" onClick={() => navigate('/analytics')}>
                  all <ArrowUpRight size={12}/>
                </button>
              </div>
              <div className="cb-panel-sub">{sessionsTotal} sessions total · {stats.weeklyPoints} pts this week</div>
              <svg viewBox={`0 0 ${weeklyChart.w} ${weeklyChart.h}`} className="cb-line" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="cb-line-fade" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32"/>
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <path d={weeklyChart.area} fill="url(#cb-line-fade)"/>
                <path d={weeklyChart.path} fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                {weeklyChart.points.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="3" fill="var(--accent)"/>
                    <text x={p.x} y={weeklyChart.h - 6} textAnchor="middle" className="cb-line-x">{todayLabel[i]}</text>
                  </g>
                ))}
              </svg>
            </div>

            <div className="cb-panel cb-panel--prog">
              <div className="cb-panel-head">
                <span className="cb-panel-title">Progress</span>
              </div>
              <div className="cb-rings">
                {[
                  { k: 'CHATS', v: stats.chats, t: ringTargets.chats },
                  { k: 'NOTES', v: stats.notes, t: ringTargets.notes },
                  { k: 'CARDS', v: stats.cards, t: ringTargets.cards },
                  { k: 'QUIZZES', v: stats.quizzes, t: ringTargets.quizzes }
                ].map(r => {
                  const p = pct(r.v, r.t);
                  const C = 2 * Math.PI * 18;
                  const dash = (p / 100) * C;
                  return (
                    <div className="cb-ring" key={r.k}>
                      <svg viewBox="0 0 44 44" className="cb-ring-svg">
                        <circle cx="22" cy="22" r="18" stroke="var(--border)" strokeWidth="3" fill="none"/>
                        <circle cx="22" cy="22" r="18" stroke="var(--accent)" strokeWidth="3" fill="none"
                          strokeDasharray={`${dash} ${C}`} strokeLinecap="round"
                          transform="rotate(-90 22 22)"/>
                      </svg>
                      <div className="cb-ring-num">{r.v}</div>
                      <div className="cb-ring-lbl">{r.k}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="cb-panel cb-panel--rank">
              <div className="cb-panel-head">
                <span className="cb-panel-title">Global Rank</span>
                <span className="cb-rank-num">#{stats.rank || 1}</span>
              </div>
              <ul className="cb-rank-list">
                <li>
                  <span className="cb-rank-dot" />
                  <span className="cb-rank-name">Perfect Score</span>
                  <span className="cb-rank-pts">+250</span>
                </li>
                <li>
                  <span className="cb-rank-dot" />
                  <span className="cb-rank-name">Study Streak</span>
                  <span className="cb-rank-pts">+500</span>
                </li>
                <li>
                  <span className="cb-rank-dot" />
                  <span className="cb-rank-name">Note Taker</span>
                  <span className="cb-rank-pts">+200</span>
                </li>
              </ul>
              <button className="cb-rank-cta" onClick={() => navigate('/leaderboards')}>
                View Leaderboard <ArrowUpRight size={12}/>
              </button>
            </div>
          </section>

          {/* Heatmap full-width row */}
          <section className="cb-panel cb-panel--heat cb-heat-full">
            <div className="cb-panel-head">
              <span className="cb-panel-title">Heatmap</span>
              <span className="cb-panel-sub">Activity over the last year</span>
            </div>
            <div className="cb-heat-grid">
              {heatmapWeeks.length === 0 ? (
                <div className="cb-heat-empty">No activity yet</div>
              ) : heatmapWeeks.map((week, wi) => (
                <div className="cb-heat-col" key={wi}>
                  {week.map((d, di) => (
                    <span
                      key={di}
                      className={`cb-heat-cell cb-l${d.level || 0}`}
                      title={d ? `${d.date}: ${d.count}` : ''}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="cb-heat-legend">
              <span>less</span>
              <span className="cb-heat-cell cb-l0"/>
              <span className="cb-heat-cell cb-l1"/>
              <span className="cb-heat-cell cb-l2"/>
              <span className="cb-heat-cell cb-l3"/>
              <span className="cb-heat-cell cb-l4"/>
              <span>more</span>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default DashboardCerbyl;
