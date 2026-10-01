/*
THESIS: Weaknesses are a ranked route forward, not a gallery of failure cards.
OWN-WORLD: A dark diagnostic ledger with warm drafting lines, severity ink, and paper-like rows.
STORY: See the highest-leverage gap, understand its evidence, then enter targeted practice.
FIRST VIEWPORT: Familiar Cerbyl sidebar beside a priority diagnosis, filter rail, and ranked queue.
FORM: Operate-mode triage desk inside the established Cerbyl visual system.
*/
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleGauge,
  Clock3,
  Cpu,
  FileText,
  Layers3,
  MessageCircle,
  Play,
  RefreshCw,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import './Weaknesses.css';
import { API_URL } from '../config';
import { queuedAIJsonFetch } from '../services/aiJobService';
import { getRecentMistakes, explainMistake } from '../services/weaknessMistakeService';
import WeaknessTracker from '../components/WeaknessTracker/WeaknessTracker';
import RLInsights from '../components/RLInsights/RLInsights';
import SocialHubChrome from '../components/SocialHubChrome';
import MathRenderer from '../components/MathRenderer';

const VIEWS = [
  { id: 'weak-areas', label: 'Priority diagnosis', icon: Target },
  { id: 'topics-hub', label: 'Topic mastery', icon: BookOpen },
  { id: 'intelligence', label: 'Intelligence', icon: Cpu },
  { id: 'how-i-learn', label: 'How I learn', icon: Brain },
  { id: 'activity', label: 'Activity', icon: Clock3 },
];

const CATEGORY = {
  critical: { label: 'Critical', tone: 'red' },
  needs_practice: { label: 'Needs practice', tone: 'amber' },
  improving: { label: 'Improving', tone: 'green' },
};

const SCORE_SOURCE_LABELS = { flashcard: 'flashcards', quiz: 'quizzes', chat: 'tutor chat' };
const TREND_LABELS = { improving: 'improving', slipping: 'slipping', steady: 'holding steady' };

const MISTAKE_SOURCES = {
  question_bank: { label: 'Practice', icon: BookOpen },
  solo_quiz: { label: 'Quiz', icon: BookOpen },
  flashcard: { label: 'Flashcard', icon: Layers3 },
  chat: { label: 'AI Chat', icon: MessageCircle },
};

// What to do next for one weak topic, from its score and which mistakes are
// still open (a mistake is "fixed" once the student later got it right).
const topicNextSteps = (area, label, openMistakes, fixedCount) => {
  const score = Math.round(area.weakness_score || 0);
  const sources = area.sources || [];
  const openCards = openMistakes.filter((m) => m.source === 'flashcard').length;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  let headline;
  if (openMistakes.length === 0 && fixedCount > 0) {
    headline = score < 40
      ? `You've fixed all ${plural(fixedCount, 'mistake')} here. A quick quiz will confirm it sticks.`
      : `You've fixed the ${plural(fixedCount, 'mistake')} you made, but the model wants more evidence before it trusts this topic. Test yourself on new questions.`;
  } else if (score >= 70) {
    headline = openMistakes.length
      ? `Priority topic. Start with the ${plural(openMistakes.length, 'mistake')} you haven't fixed yet, then get it explained step by step.`
      : 'Priority topic. Get it explained step by step, then test yourself.';
  } else if (score >= 40) {
    headline = openMistakes.length
      ? `Partly there. Clear the ${plural(openMistakes.length, 'open mistake')}, then a short quiz will show whether it's sticking.`
      : "Partly there. A short quiz will show whether it's sticking.";
  } else {
    headline = 'Nearly mastered. Keep it fresh with a quick review every few days.';
  }
  if (area.trend === 'slipping' && score >= 40) headline += ' Your recent answers are trending the wrong way.';

  const actions = [];
  if (openCards > 0) {
    actions.push({ key: 'cards', label: `Review ${plural(openCards, 'missed card')}`, to: '/flashcards/review' });
  }
  if (score >= 40 || !sources.includes('quiz')) {
    actions.push({
      key: 'quiz',
      label: 'Quiz me on it',
      to: '/solo-quiz',
      state: { autoStart: true, topics: [label], difficulty: score >= 70 ? 'easy' : 'medium', questionCount: 5 },
    });
  }
  if (score >= 40) {
    actions.push({
      key: 'chat',
      label: 'Explain it in AI Chat',
      to: '/ai-chat',
      state: { initialMessage: `Help me with ${label}. I keep getting it wrong, so walk me through it step by step and check my understanding.` },
    });
  }
  return { headline, actions: actions.slice(0, 3) };
};

const Weaknesses = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('username');

  const [activeView, setActiveView] = useState('weak-areas');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [weakAreasData, setWeakAreasData] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activityFeed, setActivityFeed] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [topicsHub, setTopicsHub] = useState(null);
  const [topicsHubLoading, setTopicsHubLoading] = useState(false);
  const [topicsHubFilter, setTopicsHubFilter] = useState('all');

  const [mistakes, setMistakes] = useState([]);
  const [mistakeTopics, setMistakeTopics] = useState([]);
  const [mistakesLoading, setMistakesLoading] = useState(true);
  const [explainState, setExplainState] = useState(null); // { mistake, loading, content, error }

  const loadRecentMistakes = async () => {
    setMistakesLoading(true);
    try {
      const data = await getRecentMistakes(userName, { limit: 40 });
      setMistakes(data.mistakes || []);
      setMistakeTopics(data.topics || []);
    } catch (requestError) {
      console.error('Error loading recent mistakes:', requestError);
      setError(requestError.message || 'Your recent mistakes could not be loaded.');
    } finally {
      setMistakesLoading(false);
    }
  };

  const openMistakeExplanation = async (mistake) => {
    setExplainState({ mistake, loading: true, content: null, error: '' });
    try {
      const data = await explainMistake(userName, mistake.id, mistake.source);
      setExplainState({ mistake, loading: false, content: data.content, error: '' });
    } catch (requestError) {
      setExplainState({ mistake, loading: false, content: null, error: requestError.message || 'Could not generate an explanation.' });
    }
  };

  const loadWeakAreas = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await queuedAIJsonFetch(`/study_insights/strengths_weaknesses?user_id=${userName}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Your diagnosis could not be refreshed.');
      setWeakAreasData(await response.json());
    } catch (requestError) {
      console.error('Error loading weak areas:', requestError);
      setError(requestError.message || 'Your diagnosis could not be refreshed.');
    } finally {
      setLoading(false);
    }
  };

  const loadTopicsHub = async () => {
    setTopicsHubLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/weakness-practice/mastery-overview?user_id=${encodeURIComponent(userName)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Topic mastery is unavailable right now.');
      setTopicsHub(await response.json());
    } catch (requestError) {
      setError(requestError.message || 'Topic mastery is unavailable right now.');
    } finally {
      setTopicsHubLoading(false);
    }
  };

  const loadActivityFeed = async () => {
    setActivityLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/study_insights/activity_feed?user_id=${encodeURIComponent(userName)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Recent learning activity is unavailable right now.');
      setActivityFeed(await response.json());
    } catch (requestError) {
      setError(requestError.message || 'Recent learning activity is unavailable right now.');
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadWeakAreas();
    loadRecentMistakes();
    // The diagnosis intentionally loads once when this workspace opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchView = (view) => {
    setActiveView(view);
    setError('');
    if (view === 'topics-hub' && !topicsHub) loadTopicsHub();
    if (view === 'activity' && !activityFeed) loadActivityFeed();
  };

  const weakGroups = weakAreasData?.weak_areas || {};
  const hasWeakGroups = weakAreasData?.weak_areas && typeof weakAreasData.weak_areas === 'object';
  const criticalCount = hasWeakGroups && Array.isArray(weakGroups.critical) ? weakGroups.critical.length : (weakAreasData?.summary?.critical_count || 0);
  const needsPracticeCount = hasWeakGroups && Array.isArray(weakGroups.needs_practice) ? weakGroups.needs_practice.length : (weakAreasData?.summary?.needs_practice_count || 0);
  const improvingCount = hasWeakGroups && Array.isArray(weakGroups.improving) ? weakGroups.improving.length : (weakAreasData?.summary?.improving_count || 0);
  const totalCount = criticalCount + needsPracticeCount + improvingCount;
  const allAreas = [
    ...(weakGroups.critical || []),
    ...(weakGroups.needs_practice || []),
    ...(weakGroups.improving || []),
  ];
  const priorityFocus = allAreas.find((area) => {
    const topic = String(area?.topic || '').trim().toLowerCase();
    return topic && topic !== 'none' && topic !== 'null';
  }) || allAreas[0];
  const activeNav = VIEWS.find((item) => item.id === activeView);

  const pageTitle = {
    'weak-areas': 'Weak Areas',
    'topics-hub': 'Topic Mastery',
    intelligence: 'Learning Insights',
    'how-i-learn': 'Learning Preferences',
    activity: 'Learning Activity',
  }[activeView];
  const pageDescription = {
    'weak-areas': 'Rank the strongest learning signals, inspect their evidence, and move directly into targeted practice.',
    'topics-hub': 'See every tracked topic by mastery, recency, and the next action that will make a difference.',
    intelligence: 'Understand how long-term mastery, study frequency, and repeated mistakes shaped this diagnosis.',
    'how-i-learn': 'Review the teaching patterns Cerbyl uses to adapt explanations and recovery sessions to you.',
    activity: 'Follow the recent study events that are changing your diagnosis and learning trajectory.',
  }[activeView];

  const practiceTopTopic = () => {
    if (priorityFocus?.topic) navigate(`/weakness-tips/${encodeURIComponent(priorityFocus.topic)}`);
  };

  const sidebarLead = (
    <button type="button" className="wa-practice-now" onClick={practiceTopTopic} disabled={!priorityFocus?.topic}>
      <Play size={15} fill="currentColor" />
      <span>Practice now</span>
    </button>
  );

  const sidebarTail = totalCount > 0 ? (
    <section className="wa-sidebar-signal" aria-label="Current diagnosis">
      <div><span>Current diagnosis</span><strong>{totalCount}</strong></div>
      <div className="wa-signal-track" aria-hidden="true">
        <i className="critical" style={{ flex: criticalCount || 0.001 }} />
        <i className="practice" style={{ flex: needsPracticeCount || 0.001 }} />
        <i className="improving" style={{ flex: improvingCount || 0.001 }} />
      </div>
      <dl>
        <div><dt>Critical</dt><dd>{criticalCount}</dd></div>
        <div><dt>Practice</dt><dd>{needsPracticeCount}</dd></div>
        <div><dt>Improving</dt><dd>{improvingCount}</dd></div>
      </dl>
    </section>
  ) : null;

  return (
    <div className="wa-root with-social-chrome" data-view={activeView}>
      <SocialHubChrome
        brandKicker="Weak Areas"
        sidebarLead={sidebarLead}
        sidebarTail={sidebarTail}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        sideSections={[{
          label: 'Learning focus',
          items: VIEWS.map(({ id, label, icon }) => ({
            icon,
            label,
            active: activeView === id,
            onClick: () => switchView(id),
            count: id === 'weak-areas' ? totalCount : id === 'topics-hub' ? topicsHub?.total_topics : null,
          })),
        }]}
      >
        <main className="wa-main">
          <header className="wa-hero">

            <h1 className="plain-page-title">{pageTitle}</h1>

          </header>

          <section className="wa-content-toolbar" aria-label="Diagnosis status">
            <div className="wa-main-meta">
              <span><strong>{totalCount}</strong>signals</span>
              <span><strong>{allAreas.reduce((sum, area) => sum + (area.total_attempts || 0), 0)}</strong>attempts</span>
              {['weak-areas', 'topics-hub', 'activity'].includes(activeView) ? (
                <button type="button" onClick={activeView === 'weak-areas' ? () => { loadWeakAreas(); loadRecentMistakes(); } : activeView === 'topics-hub' ? loadTopicsHub : loadActivityFeed} aria-label={`Refresh ${activeNav?.label}`}>
                  <RefreshCw size={16} />
                </button>
              ) : null}
            </div>
          </section>

          {error ? <div className="wa-error" role="alert"><AlertTriangle size={16} /><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss error"><X size={15} /></button></div> : null}

          <div className="wa-stage" key={activeView}>
            {activeView === 'weak-areas' && (
              <DiagnosisView
                loading={loading || mistakesLoading}
                failed={Boolean(error) && !allAreas.length}
                areas={allAreas}
                onStartLearning={() => navigate('/ai-chat')}
                onRetry={() => { loadWeakAreas(); loadRecentMistakes(); }}
                mistakes={mistakes}
                mistakesLoading={mistakesLoading}
                onExplainMistake={openMistakeExplanation}
                onNavigate={navigate}
              />
            )}

            {activeView === 'topics-hub' && (
              <TopicsView
                loading={topicsHubLoading}
                failed={Boolean(error) && !topicsHub}
                data={topicsHub}
                filter={topicsHubFilter}
                onFilter={setTopicsHubFilter}
                onPractice={(topic) => navigate(`/weakness-tips/${encodeURIComponent(topic)}`)}
                onStartLearning={() => navigate('/ai-chat')}
                onRetry={loadTopicsHub}
              />
            )}

            {activeView === 'intelligence' && (
              <section className="wa-component-panel">
                <header className="wa-component-intro">
                  <div><Cpu size={20} /><span>Pattern intelligence</span></div>
                  <h2>Learning Diagnosis</h2>

                </header>
                <WeaknessTracker
                  userId={userName}
                  token={token}
                  onNavigate={navigate}
                  emptyFallback={(
                    <IntelligenceFallback
                      areas={allAreas}
                      totalCount={totalCount}
                      criticalCount={criticalCount}
                      needsPracticeCount={needsPracticeCount}
                      onPractice={(topic) => navigate(`/weakness-tips/${encodeURIComponent(topic)}`)}
                      onPracticeAll={practiceTopTopic}
                    />
                  )}
                />
              </section>
            )}

            {activeView === 'how-i-learn' && (
              <section className="wa-component-panel">
                <header className="wa-component-intro">
                  <div><Brain size={20} /><span>Teaching strategy</span></div>
                  <h2>Study Methods</h2>

                </header>
                <RLInsights userName={userName} token={token} />
              </section>
            )}

            {activeView === 'activity' && (
              <ActivityView loading={activityLoading} failed={Boolean(error) && !activityFeed} feed={activityFeed} onStartLearning={() => navigate('/ai-chat')} onRetry={loadActivityFeed} />
            )}
          </div>
        </main>
      </SocialHubChrome>
      <MistakeExplanationModal state={explainState} onClose={() => setExplainState(null)} />
    </div>
  );
};

const IntelligenceFallback = ({
  areas,
  totalCount,
  criticalCount,
  needsPracticeCount,
  onPractice,
  onPracticeAll,
}) => {
  const signals = areas.filter((area) => String(area?.topic || '').trim()).slice(0, 3);
  const attempts = areas.reduce((sum, area) => sum + (Number(area?.total_attempts) || 0), 0);
  const wrongAnswers = areas.reduce((sum, area) => sum + (Number(area?.total_wrong) || 0), 0);

  if (!totalCount) {
    return (
      <section className="wa-intelligence-fallback wa-intelligence-fallback--empty">
        <div className="wa-intelligence-empty-icon"><Cpu size={24} /></div>
        <div>
          <span className="wa-intelligence-eyebrow">Building your pattern map</span>
          <h3>Keep learning to unlock intelligence.</h3>
          <p>Cerbyl needs a few more answered questions before it can identify reliable learning patterns.</p>
        </div>
        <button type="button" className="wa-intelligence-primary" onClick={onPracticeAll}>Practice now</button>
      </section>
    );
  }

  return (
    <section className="wa-intelligence-fallback">
      <div className="wa-intelligence-status">
        <div>
          <span className="wa-intelligence-eyebrow">Live diagnosis signals</span>
          <h3>Your pattern profile is taking shape.</h3>
          <p>These signals are already strong enough to guide your next recovery session. Deeper trend analysis appears as your study history grows.</p>
        </div>
        <button type="button" className="wa-intelligence-primary" onClick={onPracticeAll}>Practice priority gaps</button>
      </div>

      <div className="wa-intelligence-stats" aria-label="Current intelligence signals">
        <div><span>Active signals</span><strong>{totalCount}</strong></div>
        <div><span>Critical gaps</span><strong>{criticalCount}</strong></div>
        <div><span>Needs practice</span><strong>{needsPracticeCount}</strong></div>
        <div><span>Evidence captured</span><strong>{attempts} <small>attempts</small></strong></div>
      </div>

      <div className="wa-intelligence-list">
        <div className="wa-intelligence-list-heading">
          <span>Strongest current signals</span>
          <span>{wrongAnswers} missed responses</span>
        </div>
        {signals.map((area, index) => {
          const accuracy = Number.isFinite(Number(area?.accuracy)) ? Math.round(Number(area.accuracy)) : null;
          const category = CATEGORY[area?.category] || CATEGORY.critical;
          return (
            <article className="wa-intelligence-signal" key={`${area?.topic || 'signal'}-${index}`}>
              <span className={`wa-intelligence-severity ${category.tone}`}>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <span className={`wa-status ${category.tone}`}>{category.label}</span>
                <h4>{area.topic}</h4>
                <p>{area.evidence || `${area.total_attempts || 0} attempts have flagged this topic for focused recovery.`}</p>
              </div>
              <div className="wa-intelligence-accuracy">
                <span>Accuracy</span>
                <strong>{accuracy === null ? '—' : `${accuracy}%`}</strong>
              </div>
              <button type="button" aria-label={`Practice ${area.topic}`} onClick={() => onPractice(area.topic)}><ChevronRight size={17} /></button>
            </article>
          );
        })}
      </div>
    </section>
  );
};

const normalizeTopicKey = (topic) => String(topic || '').trim().toLowerCase();

const DiagnosisView = ({
  loading,
  failed,
  areas,
  onStartLearning,
  onRetry,
  mistakes,
  mistakesLoading,
  onExplainMistake,
  onNavigate,
}) => {
  const [expanded, setExpanded] = useState(() => new Set());
  const [showFixed, setShowFixed] = useState(() => new Set());

  if (loading) return <LoadingState label="Analyzing your performance" />;
  if (failed) return <RequestErrorState label="We could not read your diagnosis." onRetry={onRetry} />;
  if (!areas.length) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="No weak topics detected."
        copy="Your tracked topics are holding steady. Keep studying to give Cerbyl more evidence."
        action="Continue learning"
        onAction={onStartLearning}
      />
    );
  }

  const mistakesByTopic = new Map();
  mistakes.forEach((mistake) => {
    const key = normalizeTopicKey(mistake.topic);
    if (!mistakesByTopic.has(key)) mistakesByTopic.set(key, []);
    mistakesByTopic.get(key).push(mistake);
  });

  const toggleFixed = (key) => {
    setShowFixed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const renderMistake = (mistake) => {
    const meta = MISTAKE_SOURCES[mistake.source] || { label: mistake.source, icon: Target };
    const Icon = mistake.resolved ? CheckCircle2 : meta.icon;
    return (
      <button
        type="button"
        key={`${mistake.source}-${mistake.id}`}
        className={`wa-mistake-row${mistake.resolved ? ' is-fixed' : ''}`}
        onClick={() => onExplainMistake(mistake)}
      >
        <div className="wa-mistake-icon"><Icon size={14} /></div>
        <MathRenderer content={mistake.question_text || ''} className="wa-mistake-text" />
        <ChevronRight size={15} />
      </button>
    );
  };

  const toggle = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <section className="wa-queue">
      <header className="wa-queue-head">
        <div><span>Weak topics</span><strong>{areas.length} tracked · ranked by weakness score</strong></div>
      </header>
      <p className="wa-score-explainer">
        <b>Weakness score</b> (0–100, higher is weaker) is how unlikely it is that you've mastered a topic.
        A knowledge-tracing model updates it after every graded flashcard, quiz, practice question and tutor answer,
        trusting quiz and tutor-checked answers more than self-graded flashcards and hard questions more than easy ones.
        It's balanced against your full history so one lucky streak can't hide a pattern, and it creeps back up as time
        passes without practice. The AI tutor and note generator see the same number.
      </p>
      <div className="wa-queue-list">
        {areas.map((area) => {
          const key = normalizeTopicKey(area.topic);
          const isOpen = expanded.has(key);
          const topicMistakes = mistakesByTopic.get(key) || [];
          const score = Math.max(0, Math.min(100, Math.round(area.weakness_score || 0)));
          const attempts = area.total_attempts || 0;
          const correct = Math.max(0, attempts - (area.total_wrong || 0));
          const sources = (area.sources || []).map((src) => SCORE_SOURCE_LABELS[src] || src).join(', ');
          const tone = score >= 70 ? 'critical' : score >= 40 ? 'practice' : 'improving';
          const label = area.label || displayTopic(area.topic);
          return (
            <div key={key} className="wa-topic-group">
              <button type="button" className="wa-topic-row" title={label} onClick={() => toggle(key)} aria-expanded={isOpen}>
                <div className="wa-topic-body">
                  <span>{label}</span>
                  <div className={`wa-topic-track wa-score-track ${tone}`} role="progressbar" aria-label={`${label} weakness score`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={score}>
                    <i style={{ '--wa-accuracy': score / 100 }} />
                  </div>
                  <small className="wa-score-meta">
                    {correct}/{attempts} correct{sources ? ` · ${sources}` : ''}
                    {area.score_model === 'bkt' ? ` · model mastery ${Math.round((area.mastery || 0) * 100)}%` : ''}
                    {area.confidence ? ` · ${area.confidence} confidence` : ''}
                    {area.trend && TREND_LABELS[area.trend] ? ` · ${TREND_LABELS[area.trend]}` : ''}
                  </small>
                </div>
                <div className={`wa-score ${tone}`}>
                  <strong>{score}</strong>
                  <span>/100 weakness</span>
                </div>
                {isOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
              </button>
              {isOpen && (() => {
                const openMistakes = topicMistakes.filter((m) => !m.resolved);
                const fixedMistakes = topicMistakes.filter((m) => m.resolved);
                const fixedVisible = showFixed.has(key);
                const plan = topicNextSteps(area, label, openMistakes, fixedMistakes.length);
                return (
                  <div className="wa-topic-mistakes">
                    {mistakesLoading ? (
                      <div className="wa-mistakes-loading"><LoadingState label="Gathering mistakes" /></div>
                    ) : (
                      <>
                        <div className="wa-next-step">
                          <span className="wa-next-step-kicker">Next step</span>
                          <p>{plan.headline}</p>
                          {plan.actions.length > 0 && (
                            <div className="wa-next-step-actions">
                              {plan.actions.map((action) => (
                                <button
                                  type="button"
                                  key={action.key}
                                  onClick={() => onNavigate(action.to, action.state ? { state: action.state } : undefined)}
                                >
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="wa-mistake-group-label">
                          {openMistakes.length ? `Still missing · ${openMistakes.length}` : 'No open mistakes'}
                        </div>
                        {openMistakes.length === 0 ? (
                          <p className="wa-topic-mistakes-empty">
                            {fixedMistakes.length ? 'Every mistake on this topic has since been answered correctly.' : 'No recorded mistakes for this topic yet.'}
                          </p>
                        ) : openMistakes.map(renderMistake)}

                        {fixedMistakes.length > 0 && (
                          <>
                            <button type="button" className="wa-fixed-toggle" onClick={() => toggleFixed(key)} aria-expanded={fixedVisible}>
                              {fixedVisible ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              Fixed since · {fixedMistakes.length}
                            </button>
                            {fixedVisible && fixedMistakes.map(renderMistake)}
                          </>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </section>
  );
};

const MistakeExplanationModal = ({ state, onClose }) => {
  if (!state) return null;
  const { mistake, loading, content, error } = state;
  const meta = MISTAKE_SOURCES[mistake.source] || { label: mistake.source };
  return (
    <div className="wa-modal-overlay" onClick={onClose}>
      <div className="wa-modal" onClick={(e) => e.stopPropagation()}>
        <header className="wa-modal-head">
          <h3>{displayTopic(mistake.topic)}</h3>
          <button type="button" className="wa-modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <div className="wa-modal-body">
          <div className="wa-modal-source">{meta.label}</div>
          <MathRenderer content={mistake.question_text || ''} className="wa-modal-question" />
          {mistake.user_answer ? (
            <dl className="wa-modal-answers">
              <div><dt>Your answer</dt><dd><MathRenderer content={mistake.user_answer} /></dd></div>
              {mistake.correct_answer ? <div><dt>Correct answer</dt><dd><MathRenderer content={mistake.correct_answer} /></dd></div> : null}
            </dl>
          ) : null}
          {loading ? (
            <div className="wa-modal-loading"><LoadingState label="Generating explanation" /></div>
          ) : error ? (
            <p className="wa-modal-error">{error}</p>
          ) : (
            <MathRenderer content={content || ''} className="wa-modal-explanation" />
          )}
        </div>
      </div>
    </div>
  );
};

const TopicsView = ({ loading, failed, data, filter, onFilter, onPractice, onStartLearning, onRetry }) => {
  if (loading) return <LoadingState label="Loading topic mastery" />;
  if (failed) return <RequestErrorState label="We could not load topic mastery." onRetry={onRetry} />;
  if (!data || data.total_topics === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No topics tracked yet."
        copy="Quizzes, flashcards, and study chats will begin building your mastery ledger."
        action="Start learning"
        onAction={onStartLearning}
      />
    );
  }

  const breakdown = data.topic_breakdown || {};
  const topics = filter === 'all'
    ? [...(breakdown.needs_work || []), ...(breakdown.progressing || []), ...(breakdown.mastered || [])]
    : (breakdown[filter] || []);

  return (
    <section className="wa-topics">
      <header className="wa-topics-overview">
        <div><CircleGauge size={24} /><span>Overall mastery</span><strong>{data.overall_mastery || 0}%</strong></div>
        <p>{data.total_topics} tracked topics, arranged by where another session will make the biggest difference.</p>
      </header>
      <div className="wa-filters" role="group" aria-label="Filter topic mastery">
        {[
          ['all', 'All topics', data.total_topics],
          ['needs_work', 'Needs work', data.needs_work_topics],
          ['progressing', 'Progressing', data.progressing_topics],
          ['mastered', 'Mastered', data.mastered_topics],
        ].map(([key, label, count]) => (
          <button key={key} type="button" className={filter === key ? 'active' : ''} onClick={() => onFilter(key)} aria-pressed={filter === key}>
            {label}<small>{count || 0}</small>
          </button>
        ))}
      </div>
      <div className="wa-topic-list">
        {topics.length ? topics.map((topic, index) => <TopicRow key={`${topic.topic}-${index}`} topic={topic} onPractice={() => onPractice(topic.topic)} />) : (
          <div className="wa-filter-empty"><CheckCircle2 size={24} /><span>No topics are in this mastery group yet.</span><button type="button" onClick={() => onFilter('all')}>Show all topics</button></div>
        )}
      </div>
    </section>
  );
};

const TopicRow = ({ topic, onPractice }) => {
  const mastery = Math.max(0, Math.min(100, Math.round((topic.mastery_level || 0) * 100)));
  const state = mastery >= 80 ? 'Mastered' : mastery >= 50 ? 'Progressing' : 'Needs work';
  return (
    <article className="wa-topic-row">
      <div className="wa-topic-state" role="progressbar" aria-label={`${displayTopic(topic.topic)} mastery`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={mastery}><span>{state}</span><strong>{mastery}%</strong></div>
      <div className="wa-topic-copy">
        <h3>{topic.topic || 'Unknown topic'}</h3>
        <span>{(topic.struggles_with || []).slice(0, 2).join(' · ') || 'No specific struggle recorded'}</span>
      </div>
      <div className="wa-topic-stats">
        <span><b>{topic.accuracy || 0}%</b> accuracy</span>
        <span><b>{topic.times_studied || 0}</b> sessions</span>
        <span>{formatLastPracticed(topic.last_practiced)}</span>
      </div>
      <button type="button" onClick={onPractice}>Open topic</button>
    </article>
  );
};

const ActivityView = ({ loading, failed, feed, onStartLearning, onRetry }) => {
  if (loading) return <LoadingState label="Loading recent activity" />;
  if (failed) return <RequestErrorState label="We could not load recent activity." onRetry={onRetry} />;
  if (!feed?.activities?.length) {
    return (
      <EmptyState
        icon={Activity}
        title="No learning activity yet."
        copy="Your study actions will appear here as evidence for future diagnoses."
        action="Start learning"
        onAction={onStartLearning}
      />
    );
  }

  return (
    <section className="wa-activity">
      <header><span>Recent evidence</span><strong>{feed.activities.length} events</strong></header>
      <div>{feed.activities.map((activity, index) => <ActivityRow key={`${activity.ts}-${index}`} activity={activity} />)}</div>
    </section>
  );
};

const ACTIVITY_ICONS = {
  chat: MessageCircle,
  note: FileText,
  flashcard: Layers3,
  quiz: CheckCircle2,
  weak_area: Target,
};

const ActivityRow = ({ activity }) => {
  const Icon = ACTIVITY_ICONS[activity.type] || Activity;
  return (
    <article className="wa-activity-row">
      <div><Icon size={17} /></div>
      <span><strong>{activity.topic || 'Learning activity'}</strong><small>{activity.detail || activity.type}</small></span>
      <time>{formatTimestamp(activity.ts)}</time>
    </article>
  );
};

const LoadingState = ({ label }) => (
  <div className="wa-loading" role="status">
    <div><span /><span /><span /></div>
    <strong>{label}</strong>
    <small>Reading your learning evidence</small>
  </div>
);

const EmptyState = ({ icon: Icon, title, copy, action, onAction }) => (
  <section className="wa-empty">
    <Icon size={34} />
    <h2>{title}</h2>
    <p>{copy}</p>
    <button type="button" onClick={onAction}>{action}</button>
  </section>
);

const RequestErrorState = ({ label, onRetry }) => (
  <section className="wa-empty wa-request-error" role="alert">
    <AlertTriangle size={34} />
    <h2>{label}</h2>
    <p>Your existing learning data has not been replaced or cleared. Retry when the service is available.</p>
    <button type="button" onClick={onRetry}><RefreshCw size={15} />Retry</button>
  </section>
);

const formatLastPracticed = (iso) => {
  if (!iso) return 'Never practiced';
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)} months ago`;
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  const difference = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(0, Math.floor(difference / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const displayTopic = (topic) => {
  const normalized = String(topic || '').trim();
  if (!normalized || normalized.toLowerCase() === 'none' || normalized.toLowerCase() === 'null') {
    return 'Unclassified concept';
  }
  // Set titles carry a source prefix ("Flashcards: Implicit differentiation").
  return normalized.replace(/^(flashcards?|ai generated|quiz)\s*:\s*/i, '') || normalized;
};

export default Weaknesses;
