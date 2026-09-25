import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Brain,
  CalendarClock,
  CheckCircle2,
  Clock,
  Play,
  RefreshCcw,
  Sparkles,
  Target,
  TriangleAlert,
} from 'lucide-react';
import './StudyQueuePanel.css';

const SECONDS_PER_CARD = 10;
const INTRO_KEY = 'fc_queue_intro_dismissed';

const STATE_META = [
  { key: 'review', countKey: 'review_count', label: 'Review', hint: 'Cards you already know, back just before you would forget them.' },
  { key: 'learning', countKey: 'learning_count', label: 'Learning', hint: 'Cards you have seen recently and are still locking in.' },
  { key: 'relearning', countKey: 'relearning_count', label: 'Relearning', hint: 'Cards you forgot and are rebuilding.' },
  { key: 'new', countKey: 'new_count', label: 'New', hint: 'Cards you have never studied.' },
];

const HOW_IT_WORKS = [
  { title: 'Recall first', body: 'Read the question and try to answer from memory before you look.' },
  { title: 'Grade honestly', body: 'Again, Hard, Good or Easy tells the scheduler how well you knew it.' },
  { title: 'It comes back later', body: 'Cards you know return after days or weeks. Cards you missed return in minutes.' },
];

const readDismissed = () => {
  try {
    return localStorage.getItem(INTRO_KEY) === '1';
  } catch {
    return false;
  }
};

const formatUntil = (iso) => {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return '';
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'any moment now';
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? '' : 's'}`;
};

const formatMinutes = (count) => {
  const minutes = Math.max(1, Math.round((count * SECONDS_PER_CARD) / 60));
  return minutes === 1 ? '1 min' : `${minutes} min`;
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const StudyQueuePanel = ({
  dueCards,
  dueStatus,
  srStats,
  needsReviewCount = 0,
  onStart,
  onRetry,
  onGenerate,
  onBrowse,
  onNeedsReview,
  aiSuggestions,
  loadingSuggestions,
  onLoadSuggestions,
}) => {
  const [introDismissed, setIntroDismissed] = useState(readDismissed);

  const dueTotal = dueCards?.due_count || 0;
  const totalCards = dueCards?.total_cards ?? srStats?.total_cards ?? 0;
  const sessionSize = dueCards?.cards?.length || 0;
  const setBreakdown = Array.isArray(dueCards?.set_breakdown) ? dueCards.set_breakdown : [];
  const segments = useMemo(
    () => STATE_META.map((meta) => ({ ...meta, count: dueCards?.[meta.countKey] || 0 })),
    [dueCards]
  );

  const dismissIntro = () => {
    setIntroDismissed(true);
    try {
      localStorage.setItem(INTRO_KEY, '1');
    } catch {
      /* the intro simply shows again next visit */
    }
  };

  const loading = dueStatus === 'loading' && !dueCards?.cards?.length && dueTotal === 0;
  const hasCards = totalCards > 0 || dueTotal > 0;

  return (
    <div className="fc-content sq-panel">
      <div className="fc-view-header">
        <span className="fc-view-kicker">Spaced repetition</span>
        <h2 className="fc-view-title">Study Queue</h2>
        <p className="fc-view-sub">
          The cards you are about to forget, picked for you every day. Review them now and they stick.
        </p>
      </div>

      {dueStatus === 'error' && (
        <div className="sq-notice sq-notice-error" role="alert">
          <TriangleAlert size={18} aria-hidden />
          <div>
            <strong>Your queue could not be loaded.</strong>
            <span>Nothing was changed. Check your connection and try again.</span>
          </div>
          <button type="button" className="sq-btn sq-btn-ghost" onClick={onRetry}>
            <RefreshCcw size={14} aria-hidden /> Retry
          </button>
        </div>
      )}

      {loading && (
        <div className="sq-hero sq-skeleton" role="status" aria-label="Loading your review queue">
          <div className="sq-skeleton-line sq-skeleton-wide" />
          <div className="sq-skeleton-line" />
          <div className="sq-skeleton-bar" />
        </div>
      )}

      {!loading && dueStatus === 'ready' && !hasCards && (
        <section className="sq-hero sq-hero-empty">
          <div className="cb-tile-texture" aria-hidden />
          <div className="sq-empty-icon"><BookOpen size={22} aria-hidden /></div>
          <h3>Your queue starts with your first cards</h3>
          <p>
            Create a flashcard set and its cards land here automatically. Each day you will see only
            the ones that are due, so you never have to decide what to study.
          </p>
          <div className="sq-actions">
            <button type="button" className="sq-btn sq-btn-primary" onClick={onGenerate}>
              <Sparkles size={15} aria-hidden /> Generate cards
            </button>
            <button type="button" className="sq-btn sq-btn-ghost" onClick={onBrowse}>
              <BookOpen size={15} aria-hidden /> My flashcards
            </button>
          </div>
        </section>
      )}

      {!loading && dueStatus === 'ready' && hasCards && dueTotal === 0 && (
        <section className="sq-hero sq-hero-clear">
          <div className="cb-tile-texture" aria-hidden />
          <div className="sq-empty-icon sq-empty-icon-ok"><CheckCircle2 size={22} aria-hidden /></div>
          <h3>You are all caught up</h3>
          <p>
            {dueCards?.next_due_date
              ? `Your next card is due ${formatUntil(dueCards.next_due_date)}. Come back then and it will be waiting here.`
              : 'Nothing is scheduled right now. New cards you create will show up here.'}
          </p>
          <div className="sq-actions">
            {needsReviewCount > 0 && (
              <button type="button" className="sq-btn sq-btn-primary" onClick={onNeedsReview}>
                <RefreshCcw size={15} aria-hidden /> Practice {plural(needsReviewCount, 'flagged card')}
              </button>
            )}
            <button type="button" className="sq-btn sq-btn-ghost" onClick={onGenerate}>
              <Sparkles size={15} aria-hidden /> Add more cards
            </button>
            <button type="button" className="sq-btn sq-btn-ghost" onClick={onBrowse}>
              <BookOpen size={15} aria-hidden /> My flashcards
            </button>
          </div>
        </section>
      )}

      {!loading && dueStatus === 'ready' && dueTotal > 0 && (
        <section className="sq-hero">
          <div className="cb-tile-texture" aria-hidden />
          <div className="sq-hero-top">
            <div className="sq-hero-figure">
              <span className="sq-hero-count">{dueTotal}</span>
              <span className="sq-hero-unit">{dueTotal === 1 ? 'card due now' : 'cards due now'}</span>
            </div>
            <div className="sq-hero-cta">
              <button type="button" className="sq-btn sq-btn-primary sq-btn-lg" onClick={() => onStart()}>
                <Play size={16} aria-hidden /> Start review
              </button>
              <span className="sq-hero-meta">
                <Clock size={13} aria-hidden /> About {formatMinutes(sessionSize || dueTotal)}
                {dueTotal > sessionSize && sessionSize > 0 ? ` for the first ${sessionSize}` : ''}
              </span>
            </div>
          </div>

          <div
            className="sq-meter"
            role="img"
            aria-label={segments.filter((s) => s.count > 0).map((s) => `${s.count} ${s.label.toLowerCase()}`).join(', ')}
          >
            {segments.map((seg) => (
              seg.count > 0 && (
                <span
                  key={seg.key}
                  className={`sq-meter-seg sq-tone-${seg.key}`}
                  style={{ flexGrow: seg.count }}
                />
              )
            ))}
          </div>

          <ul className="sq-legend">
            {segments.map((seg) => (
              <li key={seg.key} className={seg.count === 0 ? 'sq-legend-idle' : ''}>
                <span className={`sq-dot sq-tone-${seg.key}`} aria-hidden />
                <span className="sq-legend-count">{seg.count}</span>
                <span className="sq-legend-text">
                  <strong>{seg.label}</strong>
                  <em>{seg.hint}</em>
                </span>
              </li>
            ))}
          </ul>
          <p className="sq-order-note">
            Cards you are about to forget come first and brand-new cards come last, so the most valuable reviews always happen even if you stop early.
          </p>
        </section>
      )}

      {!introDismissed && (
        <section className="sq-how" aria-label="How the study queue works">
          <div className="sq-section-head">
            <span className="sq-eyebrow"><Brain size={12} aria-hidden /> How it works</span>
            <button type="button" className="sq-link" onClick={dismissIntro}>Got it</button>
          </div>
          <ol className="sq-how-steps">
            {HOW_IT_WORKS.map((step, index) => (
              <li key={step.title}>
                <span className="sq-how-num">{index + 1}</span>
                <strong>{step.title}</strong>
                <span>{step.body}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {setBreakdown.length > 0 && (
        <section className="sq-section">
          <div className="sq-section-head">
            <span className="sq-eyebrow"><Target size={12} aria-hidden /> Due by set</span>
            <span className="sq-section-note">Study one set on its own</span>
          </div>
          <ul className="sq-sets">
            {setBreakdown.map((row) => (
              <li key={row.set_id} className="sq-set-row">
                <div className="sq-set-info">
                  <strong>{row.title}</strong>
                  <span>
                    {plural(row.due_count, 'card')} due
                    {row.new_count > 0 ? ` · ${row.new_count} new` : ''}
                  </span>
                </div>
                <button type="button" className="sq-btn sq-btn-ghost sq-btn-sm" onClick={() => onStart(row.set_id)}>
                  Study <ArrowRight size={13} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {needsReviewCount > 0 && dueTotal > 0 && (
        <button type="button" className="sq-crosslink" onClick={onNeedsReview}>
          <RefreshCcw size={15} aria-hidden />
          <span>
            <strong>{plural(needsReviewCount, 'card')} flagged in Needs Review</strong>
            <em>Cards you marked by hand. They are separate from this queue.</em>
          </span>
          <ArrowRight size={15} aria-hidden />
        </button>
      )}

      {srStats && srStats.total_cards > 0 && <MemoryStats stats={srStats} />}

      <section className="sq-section sq-coach">
        <div className="cb-tile-texture" aria-hidden />
        <div className="sq-section-head">
          <span className="sq-eyebrow"><Sparkles size={12} aria-hidden /> AI study coach</span>
        </div>
        <p className="sq-coach-lead">
          Get a daily target and tips based on how your reviews are actually going.
        </p>
        <button type="button" className="sq-btn sq-btn-ghost" onClick={onLoadSuggestions} disabled={loadingSuggestions}>
          {loadingSuggestions ? 'Analyzing your reviews…' : aiSuggestions ? 'Refresh suggestions' : 'Get suggestions'}
        </button>
        {aiSuggestions && <CoachResults data={aiSuggestions} />}
      </section>
    </div>
  );
};

const MemoryStats = ({ stats }) => {
  const reviews = stats.total_reviews || 0;
  const forecast = Array.isArray(stats.review_forecast) ? stats.review_forecast : [];
  const forecastMax = Math.max(1, ...forecast.map((day) => day.count));
  const states = stats.state_distribution || {};
  const difficulty = Array.isArray(stats.ease_distribution) ? stats.ease_distribution : [];
  const difficultyTotal = stats.difficulty_total || 0;
  const hardest = stats.lapse_stats?.most_lapsed || [];
  const avgInterval = stats.maturity?.average_interval;

  const metrics = [
    {
      value: reviews > 0 ? `${stats.retention_rate || 0}%` : '–',
      label: 'Retention',
      hint: 'Reviews you answered Good or Easy',
    },
    { value: reviews, label: 'Reviews done', hint: 'Every grade you have given' },
    { value: stats.maturity?.mature_count || 0, label: 'Mature cards', hint: 'Cards that now return after 3+ weeks' },
    {
      value: avgInterval ? `${Math.round(avgInterval)}d` : '–',
      label: 'Average gap',
      hint: 'Typical wait before a learned card returns',
    },
  ];

  return (
    <section className="sq-section sq-stats">
      <div className="cb-tile-texture" aria-hidden />
      <div className="sq-section-head">
        <span className="sq-eyebrow"><CalendarClock size={12} aria-hidden /> How your memory is doing</span>
      </div>

      <div className="sq-metrics">
        {metrics.map((metric) => (
          <div key={metric.label} className="sq-metric">
            <span className="sq-metric-value">{metric.value}</span>
            <span className="sq-metric-label">{metric.label}</span>
            <span className="sq-metric-hint">{metric.hint}</span>
          </div>
        ))}
      </div>

      {forecast.length > 0 && (
        <div className="sq-block">
          <h4>Next 14 days</h4>
          <div className="sq-forecast" role="img" aria-label="Cards due per day over the next 14 days">
            {forecast.map((day) => (
              <div key={day.date} className="sq-forecast-col" title={`${day.day_label}: ${plural(day.count, 'card')}`}>
                <span className="sq-forecast-count">{day.count > 0 ? day.count : ''}</span>
                <span
                  className={`sq-forecast-bar${day.count === 0 ? ' sq-forecast-bar-empty' : ''}`}
                  style={{ height: `${Math.max(3, (day.count / forecastMax) * 72)}px` }}
                />
                <span className="sq-forecast-label">{day.day_label === 'Today' ? 'Today' : day.day_label.replace(/^\w+ 0?/, '')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sq-split">
        <div className="sq-block">
          <h4>Where your cards are</h4>
          {['new', 'learning', 'review', 'relearning'].map((state) => (
            <BarRow
              key={state}
              label={state}
              count={states[state] || 0}
              total={stats.total_cards}
              tone={state}
            />
          ))}
        </div>
        {difficultyTotal > 0 && (
          <div className="sq-block">
            <h4>How hard they feel</h4>
            {difficulty.map((bucket) => (
              <BarRow key={bucket.label} label={bucket.label} count={bucket.count} total={difficultyTotal} tone="accent" />
            ))}
          </div>
        )}
      </div>

      {hardest.length > 0 && (
        <div className="sq-block">
          <h4>Cards you keep forgetting</h4>
          <ul className="sq-hardest">
            {hardest.map((card) => (
              <li key={card.card_id}>
                <span>{card.question}</span>
                <b>{plural(card.lapses, 'lapse')}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

const BarRow = ({ label, count, total, tone }) => (
  <div className="sq-bar-row">
    <span className="sq-bar-label">{label}</span>
    <span className="sq-bar-track">
      <span
        className={`sq-bar-fill sq-tone-${tone}`}
        style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
      />
    </span>
    <span className="sq-bar-count">{count}</span>
  </div>
);

const CoachResults = ({ data }) => (
  <div className="sq-coach-results">
    {data.encouragement && <p className="sq-coach-note">{data.encouragement}</p>}
    <div className="sq-coach-stats">
      {data.daily_target && (
        <div><b>{data.daily_target}</b><span>Daily target</span></div>
      )}
      {data.optimal_new_cards_per_day !== undefined && (
        <div><b>{data.optimal_new_cards_per_day}</b><span>New cards a day</span></div>
      )}
    </div>
    {Array.isArray(data.study_tips) && data.study_tips.length > 0 && (
      <div className="sq-block">
        <h4>Tips</h4>
        <ul className="sq-tips">
          {data.study_tips.map((tip, index) => <li key={index}>{tip}</li>)}
        </ul>
      </div>
    )}
    {Array.isArray(data.problem_areas) && data.problem_areas.length > 0 && (
      <div className="sq-block">
        <h4>Where to focus</h4>
        {data.problem_areas.map((area, index) => (
          <div key={index} className={`sq-problem sq-priority-${area.priority}`}>
            <div><strong>{area.topic}</strong><span>{area.priority}</span></div>
            <p>{area.suggestion}</p>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default StudyQueuePanel;
