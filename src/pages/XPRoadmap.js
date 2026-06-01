import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Award,
  BookOpen,
  Brain,
  CheckCircle,
  ChevronRight,
  Clock,
  Crown,
  FileText,
  Flame,
  Gift,
  Layers,
  Lock,
  Map,

  MessageCircle,
  Package,
  RefreshCw,
  Rocket,
  Shield,
  Sparkles,
  Star,
  Target,
  Trophy,
  Zap
} from 'lucide-react';
import { gsap } from 'gsap';
import confetti from 'canvas-confetti';
import * as PIXI from 'pixi.js';
import './XPRoadmap.css';

const API_BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:8000/api').replace(/\/api$/, '');

const LEVEL_THRESHOLDS = [0, 100, 282, 500, 800, 1200, 1700, 2300, 3000];

const CAMPAIGN_NODES = [
  { id: 'ignite', xp: 0, title: 'Ignition Run', type: 'mission', reward: 'Origin Sigil', x: 7, y: 70, icon: Rocket },
  { id: 'spark', xp: 100, title: 'Spark Chain', type: 'mission', reward: 'Combo Token', x: 17, y: 47, icon: Zap },
  { id: 'vault-one', xp: 250, title: 'First Vault', type: 'chest', reward: 'Bronze Chest', x: 28, y: 61, icon: Package },
  { id: 'focus', xp: 500, title: 'Focus Gate', type: 'mission', reward: 'Focus Badge', x: 39, y: 34, icon: Target },
  { id: 'streak-core', xp: 800, title: 'Streak Core', type: 'mission', reward: 'Freeze Charge', x: 50, y: 54, icon: Flame },
  { id: 'weekly-raid', xp: 1200, title: 'Weekly Raid', type: 'boss', reward: 'Raid Crown', x: 62, y: 29, icon: Crown },
  { id: 'vault-two', xp: 1700, title: 'Deep Vault', type: 'chest', reward: 'Platinum Chest', x: 72, y: 51, icon: Gift },
  { id: 'recall', xp: 2500, title: 'Recall Sprint', type: 'mission', reward: 'Recall Emblem', x: 82, y: 30, icon: Brain },
  { id: 'mastery', xp: 4000, title: 'Mastery Tower', type: 'boss', reward: 'Legend Aura', x: 91, y: 58, icon: Trophy }
];

const QUEST_METRICS = [
  { id: 'chat', label: 'Dialogue', stat: 'weekly_ai_chats', goal: 'weekly_chat_goal', total: 'total_ai_chats', icon: MessageCircle },
  { id: 'notes', label: 'Notes', stat: 'weekly_notes_created', goal: 'weekly_note_goal', total: 'total_notes_created', icon: FileText },
  { id: 'flashcards', label: 'Cards', stat: 'weekly_flashcards_created', goal: 'weekly_flashcard_goal', total: 'total_flashcards_created', icon: Layers },
  { id: 'quizzes', label: 'Quizzes', stat: 'weekly_quizzes_completed', goal: 'weekly_quiz_goal', total: 'total_quizzes_completed', icon: Brain }
];

function getXpForLevel(level) {
  if (level < LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[level];
  return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + ((level - LEVEL_THRESHOLDS.length + 1) * 1000);
}

function getLevelWindow(level) {
  const start = level <= 1 ? 0 : getXpForLevel(level - 1);
  const end = getXpForLevel(level);
  return { start, end };
}

function getNodeState(node, xp, nextXp) {
  if (xp >= node.xp) return 'mastered';
  if (node.xp === nextXp) return 'active';
  return 'locked';
}

function getWeekDecayLabel() {
  const now = new Date();
  const nextMonday = new Date(now);
  const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  const diff = Math.max(0, nextMonday.getTime() - now.getTime());
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  return `${days}d ${hours}h`;
}

function hexToPixiColor(value, fallback = 0xff6b6b) {
  if (!value || !value.trim().startsWith('#')) return fallback;
  const parsed = Number.parseInt(value.trim().replace('#', ''), 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pathForSegment(from, to) {
  const x1 = from.x * 10;
  const y1 = from.y * 6;
  const x2 = to.x * 10;
  const y2 = to.y * 6;
  const mid = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mid} ${y1 - 70}, ${mid} ${y2 + 70}, ${x2} ${y2}`;
}

const MISSION_ACTIONS = {
  ignite: { label: 'Open Search Hub', route: '/search-hub' },
  spark: { label: 'Open AI Chat', route: '/ai-chat', state: { initialMessage: 'Help me plan my next study sprint.' } },
  'vault-one': { label: 'Open Notes', route: '/notes' },
  focus: { label: 'Practice Questions', route: '/question-bank' },
  'streak-core': { label: 'Review Flashcards', route: '/flashcards' },
  'weekly-raid': { label: 'Open Quiz Hub', route: '/quiz-hub' },
  'vault-two': { label: 'Open Review Hub', route: '/learning-review' },
  recall: { label: 'Start Solo Quiz', route: '/solo-quiz' },
  mastery: { label: 'Open Analytics', route: '/analytics' }
};

function getMissionAction(node) {
  return MISSION_ACTIONS[node?.id] || { label: 'Open Dashboard', route: '/dashboard-cerbyl' };
}

const XPRoadmap = () => {
  const navigate = useNavigate();
  const shellRef = useRef(null);
  const pixiRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [personalizedRoadmap, setPersonalizedRoadmap] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [xpBursts, setXpBursts] = useState([]);
  const [decayLabel, setDecayLabel] = useState(getWeekDecayLabel());
  const [levelWave, setLevelWave] = useState(false);

  const xp = stats?.total_points || 0;
  const level = stats?.level || 1;

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const userName = localStorage.getItem('username');

        if (!userName) {
          if (isMounted) setLoading(false);
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };
        const [statsRes, roadmapRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/get_gamification_stats?user_id=${encodeURIComponent(userName)}`, { headers }),
          fetch(`${API_BASE_URL}/api/xp_roadmap/personalized?user_id=${encodeURIComponent(userName)}`, { headers })
        ]);

        if (statsRes.ok) {
          const data = await statsRes.json();
          if (isMounted) setStats(data);
        }

        if (roadmapRes.ok) {
          const data = await roadmapRes.json();
          if (isMounted) setPersonalizedRoadmap(data?.roadmap || null);
        }
      } catch (error) {
        console.error('XP roadmap load error:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setDecayLabel(getWeekDecayLabel()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (loading) return undefined;

    const ctx = gsap.context(() => {
      gsap.fromTo('.xpv-run-cell', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.05, ease: 'power2.out' });
      gsap.fromTo('.xpv-stage', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' });
      gsap.fromTo('.xpv-mission-node', { opacity: 0, scale: 0.82 }, { opacity: 1, scale: 1, duration: 0.5, stagger: 0.05, ease: 'back.out(1.8)', delay: 0.18 });
      gsap.fromTo('.xpv-rail-panel', { opacity: 0, x: 18 }, { opacity: 1, x: 0, duration: 0.45, stagger: 0.08, ease: 'power2.out', delay: 0.25 });
      gsap.fromTo('.xpv-topic-arc', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.42, stagger: 0.06, ease: 'power2.out', delay: 0.35 });
    }, shellRef);

    return () => ctx.revert();
  }, [loading, stats]);

  useEffect(() => {
    if (loading) return undefined;

    const timeout = window.setTimeout(() => setLevelWave(true), 250);
    const cleanup = window.setTimeout(() => setLevelWave(false), 1500);
    return () => {
      window.clearTimeout(timeout);
      window.clearTimeout(cleanup);
    };
  }, [loading, level]);

  useEffect(() => {
    let app;
    let raf;
    let stars = [];
    let orbit;

    const setupPixi = async () => {
      if (!pixiRef.current) return;

      try {
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#ff6b6b';
        const accentColor = hexToPixiColor(accent);

        app = new PIXI.Application();
        await app.init({ backgroundAlpha: 0, antialias: true, resizeTo: pixiRef.current });
        pixiRef.current.innerHTML = '';
        pixiRef.current.appendChild(app.canvas);

        const width = pixiRef.current.clientWidth || 1000;
        const height = pixiRef.current.clientHeight || 620;

        orbit = new PIXI.Graphics();
        orbit.ellipse(width * 0.52, height * 0.48, width * 0.36, height * 0.18);
        orbit.stroke({ width: 1, color: accentColor, alpha: 0.22 });
        orbit.ellipse(width * 0.56, height * 0.5, width * 0.27, height * 0.11);
        orbit.stroke({ width: 1, color: accentColor, alpha: 0.14 });
        app.stage.addChild(orbit);

        stars = Array.from({ length: 76 }, () => {
          const dot = new PIXI.Graphics();
          const radius = Math.random() * 1.9 + 0.7;
          dot.circle(0, 0, radius);
          dot.fill({ color: Math.random() > 0.25 ? accentColor : 0xeaecef, alpha: Math.random() * 0.42 + 0.16 });
          dot.x = Math.random() * width;
          dot.y = Math.random() * height;
          app.stage.addChild(dot);
          return {
            sprite: dot,
            driftX: (Math.random() - 0.5) * 0.12,
            driftY: 0.12 + Math.random() * 0.34,
            pulse: Math.random() * Math.PI * 2
          };
        });

        app.ticker.add((ticker) => {
          const w = pixiRef.current?.clientWidth || width;
          const h = pixiRef.current?.clientHeight || height;
          if (orbit) orbit.rotation += 0.0006 * ticker.deltaTime;
          stars.forEach((star) => {
            const sprite = star.sprite;
            sprite.x += star.driftX * ticker.deltaTime;
            sprite.y += star.driftY * ticker.deltaTime;
            star.pulse += 0.025 * ticker.deltaTime;
            sprite.alpha = 0.16 + ((Math.sin(star.pulse) + 1) * 0.2);
            if (sprite.y > h + 6) {
              sprite.y = -6;
              sprite.x = Math.random() * w;
            }
          });
        });

        const render = () => {
          app.render();
          raf = window.requestAnimationFrame(render);
        };
        render();
      } catch (error) {
        console.error('XP roadmap canvas error:', error);
      }
    };

    setupPixi();

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      if (app) app.destroy(true, { children: true, texture: true });
      if (pixiRef.current) pixiRef.current.innerHTML = '';
    };
  }, [loading]);

  const levelWindow = useMemo(() => getLevelWindow(level), [level]);
  const levelProgress = useMemo(() => {
    return Math.max(0, Math.min(100, ((xp - levelWindow.start) / Math.max(1, levelWindow.end - levelWindow.start)) * 100));
  }, [xp, levelWindow]);

  const nextNode = useMemo(() => CAMPAIGN_NODES.find((node) => xp < node.xp) || null, [xp]);
  const masteredCount = useMemo(() => CAMPAIGN_NODES.filter((node) => xp >= node.xp).length, [xp]);

  const quests = useMemo(() => {
    if (!stats) return [];
    return QUEST_METRICS.map((quest) => {
      const current = Number(stats[quest.stat] || 0);
      const goal = Math.max(1, Number(stats[quest.goal] || 1));
      const progress = Math.min(100, Math.round((current / goal) * 100));
      return {
        ...quest,
        current,
        goal,
        progress,
        done: current >= goal
      };
    });
  }, [stats]);

  const runMechanics = useMemo(() => {
    const completedQuests = quests.filter((quest) => quest.done).length;
    const averageQuestProgress = quests.length
      ? Math.round(quests.reduce((total, quest) => total + quest.progress, 0) / quests.length)
      : 0;
    const combo = Math.min(2, 1 + (completedQuests * 0.2));
    const freezes = Math.min(3, Math.floor((stats?.longest_streak || 0) / 7));
    const revive = (stats?.current_streak || 0) > 0 ? 'armed' : ((stats?.longest_streak || 0) > 0 ? 'ready' : 'charging');

    return {
      completedQuests,
      averageQuestProgress,
      combo: combo.toFixed(1),
      freezes,
      revive
    };
  }, [quests, stats]);

  const chestInventory = useMemo(() => {
    return CAMPAIGN_NODES.filter((node) => node.type === 'chest').map((node) => ({
      ...node,
      state: getNodeState(node, xp, nextNode?.xp)
    }));
  }, [xp, nextNode]);

  const nextRewards = useMemo(() => {
    return CAMPAIGN_NODES.filter((node) => xp < node.xp).slice(0, 3);
  }, [xp]);

  const bossNode = useMemo(() => {
    return CAMPAIGN_NODES.find((node) => node.type === 'boss' && xp < node.xp) || CAMPAIGN_NODES.filter((node) => node.type === 'boss').slice(-1)[0];
  }, [xp]);

  const streakChain = useMemo(() => {
    const streak = stats?.current_streak || 0;
    const completed = Math.min(7, streak % 7 || (streak > 0 ? 7 : 0));
    return Array.from({ length: 7 }, (_, index) => ({
      id: `chain-${index}`,
      active: index < completed,
      current: index === completed && completed < 7
    }));
  }, [stats]);

  const powerUps = useMemo(() => {
    return [
      { id: 'freeze', label: 'Freeze', value: runMechanics.freezes, icon: Shield, charged: runMechanics.freezes > 0 },
      { id: 'revive', label: 'Revive', value: runMechanics.revive, icon: RefreshCw, charged: runMechanics.revive !== 'charging' },
      { id: 'boost', label: 'Boost', value: `x${runMechanics.combo}`, icon: Zap, charged: Number(runMechanics.combo) > 1 },
      { id: 'vault', label: 'Vaults', value: `${chestInventory.filter((chest) => chest.state === 'mastered').length}/${chestInventory.length}`, icon: Package, charged: chestInventory.some((chest) => chest.state === 'mastered') }
    ];
  }, [runMechanics, chestInventory]);

  const badgeCollection = useMemo(() => {
    return CAMPAIGN_NODES.map((node) => ({
      ...node,
      state: getNodeState(node, xp, nextNode?.xp)
    }));
  }, [xp, nextNode]);

  const seasonTrack = useMemo(() => {
    const rewardLabels = ['Origin', 'Boost', 'Vault', 'Freeze', 'Raid', 'Crown'];
    return rewardLabels.map((label, index) => {
      const threshold = [0, 150, 350, 700, 1200, 2000][index];
      return {
        id: `season-${label}`,
        label,
        threshold,
        unlocked: xp >= threshold
      };
    });
  }, [xp]);

  const selectedNodeDetails = useMemo(() => {
    if (!selectedNode) return null;

    const state = selectedNode.state || getNodeState(selectedNode, xp, nextNode?.xp);
    const questSummary = quests.slice(1).map((quest) => ({
      id: quest.id,
      label: quest.label,
      progress: quest.progress,
      done: quest.done
    }));

    return {
      ...selectedNode,
      state,
      questSummary,
      delta: Math.max(0, selectedNode.xp - xp)
    };
  }, [selectedNode, xp, nextNode, quests]);

  const selectedMissionAction = useMemo(() => {
    const targetNode = selectedNodeDetails?.state === 'locked' ? nextNode : selectedNodeDetails;
    return getMissionAction(targetNode);
  }, [selectedNodeDetails, nextNode]);

  const selectedCtaLabel = selectedNodeDetails?.state === 'locked'
    ? 'Go To Current Mission'
    : selectedMissionAction.label;

  const topicArcs = useMemo(() => {
    const topics = personalizedRoadmap?.topics || [];
    const buckets = personalizedRoadmap?.topic_milestones || {};

    return topics.slice(0, 4).map((topic) => {
      const bucket = buckets[topic.topic] || {};
      const completed = Number(bucket.completed_count || 0);
      const total = Math.max(1, Number(bucket.total_count || 1));
      return {
        topic: topic.topic,
        category: topic.category,
        activityCount: topic.activity_count,
        completed,
        total,
        progress: Math.round((completed / total) * 100)
      };
    });
  }, [personalizedRoadmap]);

  const handleNodeMove = (event) => {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) - 0.5;
    const y = ((event.clientY - rect.top) / rect.height) - 0.5;
    target.style.setProperty('--magnet-x', `${x * 14}px`);
    target.style.setProperty('--magnet-y', `${y * 14}px`);
  };

  const handleNodeLeave = (event) => {
    event.currentTarget.style.setProperty('--magnet-x', '0px');
    event.currentTarget.style.setProperty('--magnet-y', '0px');
  };

  const handleNodeClick = (node, state, event) => {
    setSelectedNode({ ...node, state });

    if (state === 'mastered') {
      const rect = event.currentTarget.getBoundingClientRect();
      const id = `${node.id}-${Date.now()}`;
      setXpBursts((items) => [...items, { id, x: rect.left + rect.width / 2, y: rect.top + 10, amount: node.xp }]);
      window.setTimeout(() => setXpBursts((items) => items.filter((item) => item.id !== id)), 950);

      confetti({
        particleCount: node.type === 'boss' ? 220 : 120,
        spread: node.type === 'boss' ? 98 : 72,
        startVelocity: node.type === 'boss' ? 58 : 42,
        scalar: 0.92,
        colors: ['#ff6b6b', '#EAECEF', '#ffd43b', '#51cf66']
      });
    }

    if (state === 'active') {
      gsap.fromTo(event.currentTarget, { scale: 1 }, { scale: 1.08, yoyo: true, repeat: 1, duration: 0.16, ease: 'power2.out' });
    }
  };

  const handleContinueMission = () => {
    const targetNode = selectedNodeDetails?.state === 'locked' ? nextNode : selectedNodeDetails;
    const action = getMissionAction(targetNode);

    setSelectedNode(null);
    navigate(action.route, action.state ? { state: action.state } : undefined);
  };

  if (loading) {
    return (
      <div className="xpv-loading">
        <div className="xpv-loader-ring" />
        <p>Booting XP campaign</p>
      </div>
    );
  }

  return (
    <div className="xpv-shell" ref={shellRef}>
      <div className="xpv-bg-fx" aria-hidden="true">
        <div className="xpv-bg-orb xpv-bg-orb-1" />
        <div className="xpv-bg-orb xpv-bg-orb-2" />
        <div className="xpv-bg-dots" />
        <div className="xpv-bg-vignette" />
      </div>

      {levelWave && <div className="xpv-level-wave" aria-hidden="true" />}

      <main className="xpv-content">
        <section className="xpv-run-strip" aria-label="Current run">
          <div className="xpv-run-cell">
            <Flame size={18} />
            <span>Run streak</span>
            <strong>{stats?.current_streak || 0}d</strong>
          </div>
          <div className="xpv-run-cell is-hot">
            <Zap size={18} />
            <span>Combo</span>
            <strong>x{runMechanics.combo}</strong>
          </div>
          <div className="xpv-run-cell">
            <Target size={18} />
            <span>Daily target</span>
            <strong>{runMechanics.averageQuestProgress}%</strong>
          </div>
          <div className="xpv-run-cell">
            <Shield size={18} />
            <span>Freezes</span>
            <strong>{runMechanics.freezes}</strong>
          </div>
          <div className="xpv-run-cell">
            <RefreshCw size={18} />
            <span>Revive</span>
            <strong>{runMechanics.revive}</strong>
          </div>
          <div className="xpv-run-cell">
            <Clock size={18} />
            <span>Combo decay</span>
            <strong>{decayLabel}</strong>
          </div>
        </section>

        <section className="xpv-campaign-grid">
          <div className="xpv-stage">
            <div className="xpv-stage-canvas" ref={pixiRef} aria-hidden="true" />
            <div className="xpv-stage-scanline" aria-hidden="true" />

            <div className="xpv-stage-header">
              <div>
                <span className="xpv-kicker">Current Campaign</span>
                <h1>Road to {nextNode?.title || 'Ascendant Core'}</h1>
              </div>
              <div className="xpv-level-module" style={{ '--level-progress': `${levelProgress}%` }}>
                <span>LEVEL {level}</span>
                <strong>{xp.toLocaleString()} XP</strong>
              </div>
            </div>

            <svg className="xpv-path-svg" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
              {CAMPAIGN_NODES.slice(1).map((node, index) => {
                const previous = CAMPAIGN_NODES[index];
                const state = getNodeState(node, xp, nextNode?.xp);
                const previousMastered = xp >= previous.xp;
                const segmentState = state === 'mastered' ? 'mastered' : (previousMastered && state === 'active' ? 'active' : 'locked');
                return (
                  <path
                    key={`${previous.id}-${node.id}`}
                    className={`xpv-path-segment ${segmentState}`}
                    d={pathForSegment(previous, node)}
                  />
                );
              })}
            </svg>

            <div className="xpv-node-layer">
              {CAMPAIGN_NODES.map((node) => {
                const state = getNodeState(node, xp, nextNode?.xp);
                const Icon = node.icon;
                return (
                  <button
                    key={node.id}
                    type="button"
                    className={`xpv-mission-node ${state} type-${node.type}`}
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                    onMouseMove={handleNodeMove}
                    onMouseLeave={handleNodeLeave}
                    onClick={(event) => handleNodeClick(node, state, event)}
                    aria-label={`${node.title} ${state}`}
                  >
                    <span className="xpv-node-aura" />
                    <span className="xpv-node-core">
                      {state === 'locked' ? <Lock size={22} /> : <Icon size={24} />}
                    </span>
                    <span className="xpv-node-copy">
                      <strong>{node.title}</strong>
                      <small>{node.xp.toLocaleString()} XP</small>
                    </span>
                </button>
              );
            })}
            </div>

            <div className="xpv-stage-footer">
              <div>
                <Map size={16} />
                <span>{masteredCount}/{CAMPAIGN_NODES.length} missions mastered</span>
              </div>
              <div>
                <Award size={16} />
                <span>{Math.max(0, levelWindow.end - xp).toLocaleString()} XP to level {level + 1}</span>
              </div>
            </div>
          </div>

          <aside className="xpv-rail" aria-label="Quest systems">
            <section className="xpv-rail-panel xpv-next-panel">
              <div className="xpv-panel-title">
                <Target size={16} />
                <h2>Current Mission</h2>
              </div>
              <div className="xpv-next-mission">
                <strong>{nextNode?.title || 'Campaign Complete'}</strong>
                <span>{nextNode ? `${Math.max(0, nextNode.xp - xp).toLocaleString()} XP remaining` : 'All mapped missions mastered'}</span>
                <div className="xpv-mini-meter">
                  <span style={{ width: `${levelProgress}%` }} />
                </div>
              </div>
            </section>

            <section className="xpv-rail-panel">
              <div className="xpv-panel-title">
                <Sparkles size={16} />
                <h2>Active Quests</h2>
              </div>
              <div className="xpv-quest-list">
                {quests.map((quest) => {
                  const Icon = quest.icon;
                  return (
                    <div key={quest.id} className={`xpv-quest-row ${quest.done ? 'done' : ''}`}>
                      <Icon size={17} />
                      <div>
                        <strong>{quest.label}</strong>
                        <span>{quest.current}/{quest.goal}</span>
                      </div>
                      <div className="xpv-mini-meter">
                        <span style={{ width: `${quest.progress}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="xpv-rail-panel">
              <div className="xpv-panel-title">
                <Crown size={16} />
                <h2>Weekly Boss</h2>
              </div>
              <div className="xpv-boss-module">
                <div className="xpv-boss-mark">
                  <Crown size={28} />
                </div>
                <strong>{bossNode?.title || 'Weekly Raid'}</strong>
                <span>{runMechanics.completedQuests}/4 quest lanes charged</span>
                <div className="xpv-mini-meter">
                  <span style={{ width: `${(runMechanics.completedQuests / 4) * 100}%` }} />
                </div>
                <div className="xpv-boss-lanes">
                  {quests.slice(1).map((quest) => (
                    <span key={quest.id} className={quest.done ? 'done' : ''}>{quest.label}</span>
                  ))}
                </div>
              </div>
            </section>
          </aside>
        </section>

        <section className="xpv-system-grid" aria-label="Progression systems">
          <section className="xpv-system-panel">
            <div className="xpv-topic-heading">
              <Flame size={17} />
              <h2>Streak Chain</h2>
            </div>
            <div className="xpv-chain xpv-chain--inline" aria-label="Streak chain">
              {streakChain.map((link, index) => (
                <span key={link.id} className={`xpv-chain-link ${link.active ? 'active' : ''} ${link.current ? 'current' : ''}`}>
                  {index + 1}
                </span>
              ))}
            </div>
          </section>

          <section className="xpv-system-panel">
            <div className="xpv-topic-heading">
              <Shield size={17} />
              <h2>Power Ups</h2>
            </div>
            <div className="xpv-power-grid">
              {powerUps.map((power) => {
                const Icon = power.icon;
                return (
                  <button key={power.id} type="button" className={`xpv-power ${power.charged ? 'charged' : ''}`}>
                    <Icon size={18} />
                    <strong>{power.value}</strong>
                    <span>{power.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="xpv-system-panel">
            <div className="xpv-topic-heading">
              <Package size={17} />
              <h2>Chest Inventory</h2>
            </div>
            <div className="xpv-chest-list">
              {chestInventory.map((chest) => (
                <button key={chest.id} type="button" className={`xpv-chest ${chest.state}`} onClick={() => setSelectedNode(chest)}>
                  <Gift size={17} />
                  <span>{chest.reward}</span>
                  {chest.state === 'mastered' ? <CheckCircle size={15} /> : <Lock size={15} />}
                </button>
              ))}
            </div>
          </section>

          <section className="xpv-system-panel">
            <div className="xpv-topic-heading">
              <Star size={17} />
              <h2>Next Rewards</h2>
            </div>
            <div className="xpv-reward-list">
              {nextRewards.length === 0 && <span className="xpv-muted">All rewards unlocked</span>}
              {nextRewards.map((reward) => (
                <div key={reward.id} className="xpv-reward-row">
                  <Gift size={15} />
                  <span>{reward.reward}</span>
                  <small>{reward.xp.toLocaleString()} XP</small>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="xpv-season-band">
          <div className="xpv-topic-heading">
            <Award size={17} />
            <h2>Season Track</h2>
          </div>
          <div className="xpv-season-track">
            {seasonTrack.map((reward) => (
              <div key={reward.id} className={`xpv-season-step ${reward.unlocked ? 'unlocked' : ''}`}>
                <span>{reward.label}</span>
                <small>{reward.threshold.toLocaleString()} XP</small>
              </div>
            ))}
          </div>
        </section>

        <section className="xpv-topic-band">
          <div className="xpv-topic-heading">
            <BookOpen size={17} />
            <h2>Personalized Topic Arcs</h2>
          </div>
          <div className="xpv-topic-arcs">
            {topicArcs.length === 0 && (
              <div className="xpv-topic-empty">No topic arcs unlocked yet.</div>
            )}
            {topicArcs.map((arc) => (
              <div key={arc.topic} className="xpv-topic-arc">
                <div>
                  <strong>{arc.topic}</strong>
                  <span>{arc.category} / {arc.activityCount} signals</span>
                </div>
                <div className="xpv-topic-meter">
                  <span style={{ width: `${arc.progress}%` }} />
                </div>
                <small>{arc.completed}/{arc.total}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="xpv-badge-band">
          <div className="xpv-topic-heading">
            <Trophy size={17} />
            <h2>Badge Codex</h2>
          </div>
          <div className="xpv-badge-grid">
            {badgeCollection.map((badge) => {
              const Icon = badge.icon;
              return (
                <button
                  key={badge.id}
                  type="button"
                  className={`xpv-badge ${badge.state}`}
                  onClick={() => setSelectedNode(badge)}
                >
                  <Icon size={18} />
                  <span>{badge.title}</span>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      {xpBursts.map((burst) => (
        <span key={burst.id} className="xpv-xp-burst" style={{ left: burst.x, top: burst.y }}>
          +{Math.max(10, Math.round(burst.amount / 10))} XP
        </span>
      ))}

      {selectedNodeDetails && (
        <div className="xpv-drawer" role="dialog" aria-modal="false">
          <div className="xpv-drawer-head">
            <div>
              <span>{selectedNodeDetails.state}</span>
              <strong>{selectedNodeDetails.title}</strong>
            </div>
            <button type="button" onClick={() => setSelectedNode(null)}>x</button>
          </div>
          <div className="xpv-drawer-reward">
            <Gift size={18} />
            <span>{selectedNodeDetails.reward}</span>
            {selectedNodeDetails.delta > 0 && <small>{selectedNodeDetails.delta.toLocaleString()} XP left</small>}
          </div>
          <div className="xpv-drawer-lanes">
            {selectedNodeDetails.questSummary.map((lane) => (
              <div key={lane.id} className={lane.done ? 'done' : ''}>
                <span>{lane.label}</span>
                <strong>{lane.progress}%</strong>
              </div>
            ))}
          </div>
          <div className="xpv-drawer-action-note">
            {selectedNodeDetails.state === 'locked' && nextNode
              ? `Locked. Continue from ${nextNode.title}.`
              : selectedMissionAction.label}
          </div>
          <button type="button" className="xpv-drawer-cta" onClick={handleContinueMission}>
            {selectedCtaLabel}
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default XPRoadmap;
