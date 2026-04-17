import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain, Layers, BookOpen, Target, Award, Mic, Swords, Map,
  ArrowRight, ChevronLeft, ChevronRight, Check,
  Database, GitBranch
} from 'lucide-react';
import logo from '../assets/logo.svg';
import './Landing.css';

const NAV = ['HOME','TEAM','PROBLEM','ARCHITECTURE','FEATURES','MARKET','COMPETITION','BUSINESS'];

const FEATURES = [
  { icon: <Brain size={19}/>,    title: 'Memory-Aware AI Tutor',   desc: 'Reads your past sessions and weak topics before every reply. A tutor with actual memory.' },
  { icon: <BookOpen size={19}/>, title: 'FSRS-6 Flashcards',       desc: 'DSR algorithm schedules every card by memory stability — not arbitrary intervals.' },
  { icon: <Target size={19}/>,   title: 'Adaptive Quizzes',        desc: 'Difficulty calibrates to your mastery. Every score updates your Neo4j knowledge graph live.' },
  { icon: <Layers size={19}/>,   title: 'Smart Notes',             desc: 'Depth (brief / standard / deep) + tone control. AI knows your gaps before writing.' },
  { icon: <Mic size={19}/>,      title: 'AI Podcasts',             desc: 'Coach, Story, Rapid Review, or Socratic mode. Any topic becomes an on-demand lesson.' },
  { icon: <Swords size={19}/>,   title: 'Live Quiz Battles',       desc: 'Real-time WebSocket multiplayer. Race friends, see live scores, track wins.' },
  { icon: <Map size={19}/>,      title: 'Knowledge Roadmaps',      desc: 'Neo4j prerequisite maps. Know exactly what to learn before attempting a topic.' },
  { icon: <Award size={19}/>,    title: 'XP & Gamification',       desc: 'Daily challenges, weekly bingo, achievements, global leaderboards. Gamified mastery.' },
];

const SYSTEMS = [
  {
    num: '01', title: 'LEARNING GRAPH', tech: 'Neo4j', icon: <Database size={12}/>,
    desc: 'Every concept you study becomes a node. Quiz scores write MASTERED or STRUGGLES_WITH edges live. REQUIRES edges block advanced topics until prerequisites are met.',
    points: ['Mastery & struggle tracked per concept', 'Prerequisite graph blocks topics out of order', 'Score < 60% → STRUGGLES_WITH edge written'],
  },
  {
    num: '02', title: 'EPISODIC MEMORY', tech: 'ChromaDB', icon: <Layers size={12}/>,
    desc: 'Every session — note, chat, quiz, flashcard review — is embedded as a semantic vector. The AI retrieves your relevant history before every new interaction.',
    points: ['3 per-user collections: episodic, important, quiz_history', 'Semantic retrieval across all past session types', 'AI reads your context before generating anything'],
  },
  {
    num: '03', title: 'ADAPTIVE ENGINE', tech: 'LangGraph', icon: <GitBranch size={12}/>,
    desc: '5 independent graphs (tutor, flashcard, quiz, note, search) each follow one pattern: fetch_context → build_prompt → generate. Custom LLM routing assigns the right model per task.',
    points: ['5 graphs, one pattern across all content types', 'fetch_context → build_prompt → generate', 'Custom multi-model routing per task type'],
  },
];

const DIFF_ROWS = [
  ['What it stores',        'Facts you typed that session',      'Every quiz score, note, chat, flashcard — linked to your permanent profile'],
  ['How memory is used',    'Passive — nothing carries over',    'Active — drives what content you see next and at what difficulty'],
  ['Spaced repetition',     'None',                              'FSRS-6 DSR model built into flashcard and quiz scheduling'],
  ['Concept dependencies',  'None',                              'Neo4j prerequisite graph ensures X is learned before Y'],
  ['Acts on your gaps',     'Waits for you to ask',              'Proactively surfaces weak topics across every session type'],
];

const COMPETITORS = [
  { name: 'NotebookLM',  lead: 'Source-grounded trust model',     win: 'Full study loop: AI tutor, quizzes, flashcards, analytics, social battles' },
  { name: 'Knowt',       lead: 'Student distribution & UX',       win: 'Knowledge graph, FSRS-6 spaced repetition, weakness remediation engine' },
  { name: 'StudyFetch',  lead: 'Feature parity: plans, voice',    win: 'Episodic AI memory, quiz battles, adaptive difficulty + concept dependency' },
  { name: 'Quizlet',     lead: 'Brand trust & content library',   win: 'True adaptive tutor with concept prerequisite awareness, not just flashcards' },
  { name: 'Khanmigo',   lead: 'Pedagogy brand & school deals',   win: 'Full student workflow: notes → quizzes → flashcards → battles in one loop' },
  { name: 'ChatGPT',    lead: 'General-purpose AI breadth',      win: 'FSRS scheduling, concept dependency graph, persistent cross-session memory' },
];

const TEAM = [
  { name: 'Aditya Lanka',       role: 'Co-Founder', initials: 'AL',
    desc: 'Product vision and go-to-market strategy. Designed the adaptive learning architecture, investor narrative, and UX framework.',
    facts: ['Product strategy & roadmap', 'Go-to-market & investor relations', 'Adaptive UX design'] },
  { name: 'Parthav Elangovan',  role: 'Co-Founder', initials: 'PE',
    desc: 'Full-stack architecture. Built LangGraph AI pipelines, Neo4j knowledge graph, FSRS-6 scheduler, ChromaDB episodic memory, and the Atlas 3D WebGL interface.',
    facts: ['LangGraph · Neo4j · ChromaDB', 'FastAPI + React full-stack', 'Atlas 3D WebGL interface'] },
];

const ROADMAP = [
  { q: 'Q1 2026', phase: 'Phase 1 · Live Now', active: true,
    items: ['AI tutor, notes, flashcards & quizzes — fully connected', 'FSRS-6, episodic memory, knowledge graph', 'Gamification, social layer, real-time quiz battles'] },
  { q: 'Q2–Q3 2026', phase: 'Phase 2',
    items: ['Native mobile app (iOS + Android)', 'School admin panel + curriculum analytics', 'District-wide deployment tools'] },
  { q: 'Q4 2026', phase: 'Phase 3',
    items: ['Partnerships with US & EU institutions', 'Multi-language: French, German, Spanish', 'LMS integration (Canvas, Blackboard)'] },
  { q: '2027+', phase: 'Phase 4',
    items: ['Open API for EdTech partners & schools', 'Cerbyl adaptive engine as a service', 'Enterprise white-label offering'] },
];

function SlideHome({ next }) {
  return (
    <div className="lnd-slide lnd-slide--home">
      <div className="lnd-home-watermark">
        <img src={logo} alt="" className="lnd-home-logo-mark"/>
      </div>
      <div className="lnd-home-content">
        <div className="lnd-home-brand">cerbyl</div>
        <div className="lnd-home-tagline">Learning, unified.</div>
        <p className="lnd-home-hook">The machine that learns to adapt to you.</p>
        <button className="lnd-home-cta" onClick={next}>
          LEARN MORE <ArrowRight size={15}/>
        </button>
      </div>
    </div>
  );
}

function SlideProblem() {
  const bars = [
    { t: '20 min', r: 58 }, { t: '1 hour', r: 44 }, { t: '24 hrs', r: 33 },
    { t: '1 week', r: 21 }, { t: '1 month', r: 10 },
  ];
  return (
    <div className="lnd-slide">
      <div className="lnd-slide-label">THE PROBLEM</div>
      <h2 className="lnd-slide-title">Your brain is actively<br/>deleting what you study.</h2>
      <p className="lnd-slide-sub">Ebbinghaus proved it in 1885. Most AI tools still ignore it in 2025.</p>
      <div className="lnd-curve">
        {bars.map(b=>(
          <div key={b.t} className="lnd-curve-col">
            <div className="lnd-curve-pct">{b.r}%</div>
            <div className="lnd-curve-bar-wrap">
              <div className="lnd-curve-bar" style={{height:`${b.r}%`}}/>
            </div>
            <div className="lnd-curve-time">{b.t}</div>
          </div>
        ))}
      </div>
      <p className="lnd-slide-footnote">
        Humans forget ~50% of new information within an hour and ~90% within a month without active retrieval practice.
        Traditional learning treats every session as isolated. Most AI tools do too — they answer your question and forget you exist.
        Cerbyl's spaced repetition and knowledge graph are <em>built into the core</em>, not bolted on.
      </p>
    </div>
  );
}

function SlideArchitecture() {
  return (
    <div className="lnd-slide">
      <div className="lnd-slide-label">THE INFRASTRUCTURE</div>
      <h2 className="lnd-slide-title">Three systems. One brain.</h2>
      <div className="lnd-arch-grid">
        {SYSTEMS.map(s=>(
          <div key={s.num} className="lnd-arch-card">
            <div className="lnd-arch-num">{s.num}</div>
            <div className="lnd-arch-head">
              <span className="lnd-arch-title">{s.title}</span>
              <span className="lnd-arch-tech">{s.icon}{s.tech}</span>
            </div>
            <p className="lnd-arch-desc">{s.desc}</p>
            <ul className="lnd-arch-list">
              {s.points.map(p=><li key={p}><Check size={9}/>{p}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="lnd-arch-footer">
        Also powering the platform: Deep Knowledge Tracing (DKT) neural model · Style Bandit for content adaptation · FSRS-6 memory scheduling
      </div>
    </div>
  );
}

function SlideFeatures() {
  return (
    <div className="lnd-slide">
      <div className="lnd-slide-label">WHAT YOU GET</div>
      <h2 className="lnd-slide-title">Eight features. One platform.</h2>
      <div className="lnd-feat-grid">
        {FEATURES.map(f=>(
          <div key={f.title} className="lnd-feat-card">
            <div className="lnd-feat-icon">{f.icon}</div>
            <div className="lnd-feat-title">{f.title}</div>
            <p className="lnd-feat-desc">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideMarket() {
  return (
    <div className="lnd-slide">
      <div className="lnd-slide-label">THE OPPORTUNITY</div>
      <h2 className="lnd-slide-title lnd-market-headline">$26B → $133B</h2>
      <div className="lnd-market-sub">Digital Education Market · 2024–2030 · 31.5% CAGR · Faster than SaaS median</div>
      <div className="lnd-stat-row">
        {[
          { v: '$133B', l: 'Market by 2030' },
          { v: '31.5%', l: 'Annual Growth Rate' },
          { v: '86%',   l: 'Students using AI tools' },
          { v: '4.3',   l: 'Apps per student workflow' },
        ].map(s=>(
          <div key={s.l} className="lnd-stat-card">
            <span className="lnd-stat-val">{s.v}</span>
            <span className="lnd-stat-lbl">{s.l}</span>
          </div>
        ))}
      </div>
      <p className="lnd-slide-footnote" style={{maxWidth:640}}>
        74.4% of this market is STEM — exactly where concept prerequisites matter most and where
        Cerbyl's knowledge graph has the deepest structural advantage.
        A student learning calculus without mastering limits needs a system that <em>knows</em> that gap exists.
        Cerbyl does.
      </p>
    </div>
  );
}

function SlideCompetition() {
  const [tab, setTab] = useState(0);
  return (
    <div className="lnd-slide">
      <div className="lnd-slide-label">COMPETITIVE ADVANTAGE</div>
      <h2 className="lnd-slide-title">Why chatbots fail at learning.</h2>
      <div className="lnd-comp-tabs">
        <button className={`lnd-ctab${tab===0?' lnd-ctab--on':''}`} onClick={()=>setTab(0)}>VS AI CHATBOTS</button>
        <button className={`lnd-ctab${tab===1?' lnd-ctab--on':''}`} onClick={()=>setTab(1)}>VS COMPETITORS</button>
      </div>
      {tab===0 ? (
        <div className="lnd-table">
          <div className="lnd-table-hd">
            <div>DIMENSION</div>
            <div>AI CHATBOTS</div>
            <div className="lnd-col-us">CERBYL</div>
          </div>
          {DIFF_ROWS.map(([feat,them,us])=>(
            <div key={feat} className="lnd-table-row">
              <div className="lnd-cell-feat">{feat}</div>
              <div className="lnd-cell-them"><span className="lnd-x">✕</span>{them}</div>
              <div className="lnd-cell-us"><Check size={10}/>{us}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="lnd-table">
          <div className="lnd-table-hd">
            <div>COMPETITOR</div>
            <div>WHAT THEY LEAD IN</div>
            <div className="lnd-col-us">WHERE CERBYL WINS</div>
          </div>
          {COMPETITORS.map(c=>(
            <div key={c.name} className="lnd-table-row">
              <div className="lnd-cell-feat lnd-cell-name">{c.name}</div>
              <div className="lnd-cell-them">{c.lead}</div>
              <div className="lnd-cell-us"><Check size={10}/>{c.win}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SlideBusiness() {
  return (
    <div className="lnd-slide">
      <div className="lnd-slide-label">BUSINESS MODEL</div>
      <h2 className="lnd-slide-title">Simple, scalable SaaS.</h2>
      <div className="lnd-biz-layout">
        <div className="lnd-price-card lnd-price-card--pro">
          <div className="lnd-price-tier">PRO</div>
          <div className="lnd-price-amount">$15</div>
          <div className="lnd-price-period">per student / month</div>
          <div className="lnd-price-tag">500K tokens · Standard usage</div>
          <ul className="lnd-price-list">
            {['AI Tutor + Notes + Flashcards + Quizzes','FSRS-6 spaced repetition','Knowledge graph & adaptive difficulty','Quiz battles & gamification'].map(f=><li key={f}><Check size={10}/>{f}</li>)}
          </ul>
        </div>
        <div className="lnd-price-card lnd-price-card--power">
          <div className="lnd-price-tier">POWER</div>
          <div className="lnd-price-amount">$25</div>
          <div className="lnd-price-period">per student / month</div>
          <div className="lnd-price-tag">3M tokens · Heavy usage + HS Mode</div>
          <ul className="lnd-price-list">
            {['Everything in Pro','Curriculum RAG (HS Mode)','Priority AI model access','Advanced analytics'].map(f=><li key={f}><Check size={10}/>{f}</li>)}
          </ul>
        </div>
        <div className="lnd-econ-panel">
          <div className="lnd-econ-section-label">UNIT ECONOMICS (PRO TIER · 10K USERS)</div>
          {[
            { l: 'Infra cost per user',       v: '$2.13 / mo' },
            { l: 'Gross margin per user',      v: '$12.87 / mo' },
            { l: 'Gross margin %',             v: '85.8%' },
            { l: 'Annual gross profit',        v: '$1.54M / year' },
            { l: 'Net profit (after trials)',  v: '$1.50M / year' },
            { l: 'Cost driver',                v: 'AI tokens (sub-linear)' },
          ].map(r=>(
            <div key={r.l} className="lnd-econ-row">
              <span className="lnd-econ-lbl">{r.l}</span>
              <span className="lnd-econ-val">{r.v}</span>
            </div>
          ))}
          <p className="lnd-econ-note">
            Best case: 500K tokens/user/mo at $0.000268/token blended cost.
            Power tier: 3M tokens/user/mo. Scales sub-linearly with volume.
          </p>
        </div>
      </div>
    </div>
  );
}

function SlideTeam({ navigate }) {
  return (
    <div className="lnd-slide lnd-slide--team">
      <div className="lnd-slide-label">THE FOUNDERS</div>

      <div className="lnd-founders-row">
        <div className="lnd-founder">
          <div className="lnd-founder-avatar">AL</div>
          <div className="lnd-founder-name">Aditya Lanka</div>
          <div className="lnd-founder-role">Co-Founder</div>
        </div>
        <div className="lnd-founders-divider"/>
        <div className="lnd-founder">
          <div className="lnd-founder-avatar">PE</div>
          <div className="lnd-founder-name">Parthav Elangovan</div>
          <div className="lnd-founder-role">Co-Founder</div>
        </div>
      </div>

      <div className="lnd-built-section">
        <div className="lnd-built-label">TOGETHER WE BUILT</div>
        <div className="lnd-built-grid">
          {[
            'LangGraph AI pipelines: tutor, flashcards, quizzes, notes, search',
            'Neo4j knowledge graph with concept mastery & prerequisite tracking',
            'ChromaDB episodic memory: 3 per-user collections, semantic retrieval',
            'FSRS-6 spaced repetition scheduler (DSR memory model)',
            'Real-time WebSocket quiz battles & social layer',
            'Atlas 3D WebGL interface for the full product experience',
            'FastAPI + React full-stack platform — fully containerized',
            'Product roadmap, investor narrative & go-to-market strategy',
          ].map(item=>(
            <div key={item} className="lnd-built-item">
              <span className="lnd-built-dot"/>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="lnd-founders-quote">
        <span className="lnd-quote-mark">"</span>
        <p className="lnd-quote-text">
          We're not outsiders. We were the students — losing hours to four different apps,
          forgetting what we studied last week, and asking AI that forgot us every morning.
          We built the tool we wished existed.
        </p>
      </div>
    </div>
  );
}

const SLIDES = [SlideHome, SlideTeam, SlideProblem, SlideArchitecture, SlideFeatures, SlideMarket, SlideCompetition, SlideBusiness];

export default function Landing() {
  const [slide, setSlide] = useState(0);
  const navigate = useNavigate();
  const total = SLIDES.length;

  const prev = useCallback(() => setSlide(s => Math.max(0, s - 1)), []);
  const next = useCallback(() => setSlide(s => Math.min(total - 1, s + 1)), []);

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next();
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next]);

  const props = { navigate, next, prev };

  return (
    <div className="lnd-root">
      <div className="lnd-bg-dots"/>

      <header className="lnd-header">
        <div className="lnd-brand" onClick={() => setSlide(0)}>cerbyl</div>
        <nav className="lnd-nav">
          {NAV.map((label, i) => (
            <button
              key={i}
              className={`lnd-npill${slide===i?' lnd-npill--on':''}`}
              onClick={() => setSlide(i)}
            >{label}</button>
          ))}
        </nav>
        <button className="lnd-login-btn" onClick={() => navigate('/login')}>LOG IN</button>
      </header>

      <div className="lnd-track" style={{ transform: `translateX(-${slide * 100}vw)` }}>
        {SLIDES.map((SlideComp, i) => (
          <div key={i} className="lnd-slide-wrap">
            <SlideComp {...props}/>
          </div>
        ))}
      </div>

      {slide > 0 && (
        <button className="lnd-arrow lnd-arrow--left" onClick={prev} aria-label="Previous">
          <ChevronLeft size={17}/>
        </button>
      )}
      {slide < total - 1 && (
        <button className="lnd-arrow lnd-arrow--right" onClick={next} aria-label="Next">
          <ChevronRight size={17}/>
        </button>
      )}

      <div className="lnd-dots-nav">
        {Array.from({length: total}, (_, i) => (
          <button
            key={i}
            className={`lnd-dot${slide===i?' lnd-dot--on':''}`}
            onClick={() => setSlide(i)}
            aria-label={`Go to slide ${i+1}`}
          />
        ))}
      </div>
    </div>
  );
}
