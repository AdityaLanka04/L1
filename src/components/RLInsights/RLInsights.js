import { useState, useEffect } from 'react';
import { Brain, TrendingUp, Zap, Target, BarChart3, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import './RLInsights.css';
import { API_URL } from '../../config';

const LABELS = {
  GUIDED_DISCOVERY:   'Guided Discovery',
  DIRECT_EXPLANATION: 'Direct Explanation',
  WORKED_EXAMPLE:     'Worked Example',
  ANALOGICAL:         'Analogical',
  SCAFFOLDED:         'Scaffolded',
  REASSURANCE_FIRST:  'Reassurance First',
  CHALLENGE_PUSH:     'Challenge Push',
  REANCHOR:           'Reanchor',
  METACOGNITIVE:      'Metacognitive',
};

const ICONS = {
  GUIDED_DISCOVERY:   '🔍',
  DIRECT_EXPLANATION: '📖',
  WORKED_EXAMPLE:     '✏️',
  ANALOGICAL:         '🔗',
  SCAFFOLDED:         '🪜',
  REASSURANCE_FIRST:  '💙',
  CHALLENGE_PUSH:     '🚀',
  REANCHOR:           '🧭',
  METACOGNITIVE:      '🪞',
};

function Bar({ value, color }) {
  const pct = Math.max(0, Math.min(100, ((value + 1) / 2) * 100));
  const c = color || (value > 0.2 ? 'var(--accent)' : value > -0.1 ? '#f59e0b' : '#ef4444');
  return (
    <div className="rli-bar">
      <div className="rli-bar-track">
        <div className="rli-bar-fill" style={{ width: `${pct}%`, background: c }} />
      </div>
      <span className="rli-bar-lbl" style={{ color: c }}>{value > 0 ? '+' : ''}{(value * 100).toFixed(0)}</span>
    </div>
  );
}

function ConfBar({ value }) {
  const pct = Math.round(value * 100);
  return (
    <div className="rli-bar">
      <div className="rli-bar-track">
        <div className="rli-bar-fill" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
      </div>
      <span className="rli-bar-lbl">{pct}%</span>
    </div>
  );
}

export default function RLInsights({ userName, token }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [tab, setTab]         = useState('overview');

  useEffect(() => { if (userName && token) load(); }, [userName]);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API_URL}/intelligence/rl/strategy-performance/${userName}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(r.status);
      setData(await r.json());
    } catch { // silenced
      setError(true);
    } finally { setLoading(false); }
  };

  if (loading) return (
    <div className="rli-card rli-loading-card">
      <Brain size={36} className="rli-spin" />
      <p>Analysing your learning patterns…</p>
    </div>
  );

  if (error || !data) return (
    <div className="rli-card rli-empty-card">
      <Brain size={44} color="var(--accent)" />
      <h3>Your AI tutor is still learning about you</h3>
      <p>Keep chatting to unlock your personalised learning profile.</p>
      <button className="rli-icon-btn" onClick={load} style={{ width: 'auto', padding: '8px 18px', gap: 6, display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 600 }}>
        <RefreshCw size={13} /> Refresh
      </button>
    </div>
  );

  const { strategy_stats, top_policy, learning_curve, overall_stats } = data;
  const totalInt    = overall_stats?.total_interactions_with_rl || 0;
  const hasData     = totalInt >= 10;
  const bestStrat   = overall_stats?.most_effective_strategy;
  const improvement = ((overall_stats?.improvement_vs_rules || 0) * 100).toFixed(1);
  const avgReward   = ((overall_stats?.avg_reward_all_time || 0) * 100).toFixed(0);

  const TABS = [
    { id: 'overview',   label: 'Overview' },
    { id: 'strategies', label: 'Strategies' },
    { id: 'policy',     label: 'Learned Policy' },
    { id: 'curve',      label: 'Learning Curve' },
  ];

  return (
    <div className="rli-wrap">
      <div className="rli-card">

        {/* Header */}
        <div className="rli-header">
          <div className="rli-title">
            <div className="rli-title-icon"><Brain size={18} /></div>
            <div>
              <h3>How You Learn Best</h3>
              <p>Reinforcement learning profile</p>
            </div>
          </div>
          <div className="rli-header-right">
            <span className="rli-badge">{totalInt} interactions tracked</span>
            <button className="rli-icon-btn" onClick={load} title="Refresh"><RefreshCw size={14} /></button>
          </div>
        </div>

        {/* Warmup banner */}
        {!hasData && (
          <div className="rli-warmup">
            <Zap size={14} />
            <span>Your AI tutor needs ~10 conversations to learn your patterns. Keep going!</span>
          </div>
        )}

        {/* Tabs */}
        <div className="rli-tabs">
          {TABS.map(t => (
            <button key={t.id} className={`rli-tab ${tab === t.id ? 'rli-tab--active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div className="rli-overview">
            <div className="rli-stats">
              <div className="rli-stat">
                <div className="rli-stat-top">
                  <div className="rli-stat-ico rli-stat-ico--blue"><Target size={16} /></div>
                </div>
                <div className="rli-stat-val">{bestStrat ? (LABELS[bestStrat] || bestStrat) : '—'}</div>
                <div className="rli-stat-lbl">Most effective style</div>
              </div>
              <div className="rli-stat">
                <div className="rli-stat-top">
                  <div className="rli-stat-ico rli-stat-ico--green"><TrendingUp size={16} /></div>
                </div>
                <div className="rli-stat-val" style={{ color: parseFloat(improvement) >= 0 ? '#10b981' : '#ef4444' }}>
                  {parseFloat(improvement) >= 0 ? '+' : ''}{improvement}%
                </div>
                <div className="rli-stat-lbl">vs rule-based learning</div>
              </div>
              <div className="rli-stat">
                <div className="rli-stat-top">
                  <div className="rli-stat-ico rli-stat-ico--purple"><BarChart3 size={16} /></div>
                </div>
                <div className="rli-stat-val">{avgReward}</div>
                <div className="rli-stat-lbl">Average reward score</div>
              </div>
            </div>

            {top_policy?.filter(p => p.pulls >= 5).length > 0 && (
              <div>
                <div className="rli-section-title">What your tutor has figured out</div>
                <div className="rli-insights">
                  {top_policy.filter(p => p.pulls >= 5).slice(0, 5).map((p, i) => (
                    <div key={i} className="rli-insight">
                      <span className="rli-insight-emoji">{ICONS[p.best_strategy] || '📚'}</span>
                      <div className="rli-insight-body">
                        <span className="rli-insight-state">{p.state_description}</span>
                        <span className="rli-insight-arrow">→</span>
                        <span className="rli-insight-strategy">{LABELS[p.best_strategy] || p.best_strategy}</span>
                      </div>
                      <ConfBar value={p.confidence} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STRATEGIES ── */}
        {tab === 'strategies' && (
          <div className="rli-strategies">
            {strategy_stats?.filter(s => s.total_pulls > 0).sort((a, b) => b.avg_reward - a.avg_reward).map(s => (
              <div key={s.strategy_id} className="rli-strat-card">
                <button className="rli-strat-btn" onClick={() => setExpanded(expanded === s.strategy_id ? null : s.strategy_id)}>
                  <span className="rli-strat-emoji">{ICONS[s.strategy_id] || '📚'}</span>
                  <span className="rli-strat-name">{LABELS[s.strategy_id] || s.strategy_id}</span>
                  <div className="rli-strat-meta">
                    <span className="rli-strat-pill">{s.total_pulls} uses</span>
                    <Bar value={s.avg_reward} />
                  </div>
                  {expanded === s.strategy_id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {expanded === s.strategy_id && (
                  <div className="rli-strat-detail">
                    <div className="rli-strat-stats">
                      <div className="rli-strat-stat"><span>Win rate</span><strong>{(s.win_rate * 100).toFixed(0)}%</strong></div>
                      <div className="rli-strat-stat"><span>Avg reward</span><strong>{s.avg_reward > 0 ? '+' : ''}{(s.avg_reward * 100).toFixed(0)}</strong></div>
                    </div>
                    {s.best_states?.length > 0 && (
                      <div className="rli-strat-states">
                        <span className="rli-states-lbl">Works best when</span>
                        <div className="rli-chips">{s.best_states.map((st, i) => <span key={i} className="rli-chip rli-chip--good">{st}</span>)}</div>
                      </div>
                    )}
                    {s.worst_states?.length > 0 && (
                      <div className="rli-strat-states">
                        <span className="rli-states-lbl">Less effective when</span>
                        <div className="rli-chips">{s.worst_states.map((st, i) => <span key={i} className="rli-chip rli-chip--bad">{st}</span>)}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── POLICY ── */}
        {tab === 'policy' && (
          <div className="rli-policy">
            {!top_policy?.length ? (
              <div className="rli-policy-empty">Not enough data yet. The AI learns after ~20 interactions.</div>
            ) : (
              <>
                <div className="rli-policy-head">
                  <span>When you are…</span><span>Best approach</span><span>Confidence</span><span>Uses</span>
                </div>
                <div className="rli-policy-rows">
                  {top_policy.map((p, i) => (
                    <div key={i} className="rli-policy-row">
                      <span className="rli-policy-state">{p.state_description}</span>
                      <span className="rli-policy-strat"><span>{ICONS[p.best_strategy] || '📚'}</span>{LABELS[p.best_strategy] || p.best_strategy}</span>
                      <ConfBar value={p.confidence} />
                      <span className="rli-policy-pulls">{p.pulls}×</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── CURVE ── */}
        {tab === 'curve' && (
          <div className="rli-curve">
            {!learning_curve?.avg_reward_by_week?.length ? (
              <div className="rli-curve-empty">No weekly data yet — keep learning!</div>
            ) : (
              <>
                <div className="rli-chart">
                  {learning_curve.avg_reward_by_week.map((wk, i) => {
                    const pct = Math.max(5, Math.min(100, ((wk.avg_reward + 1) / 2) * 100));
                    const col = wk.avg_reward > 0.1 ? 'var(--accent)' : '#f59e0b';
                    return (
                      <div key={i} className="rli-bar-wrap" title={`Week ${wk.week}: ${(wk.avg_reward * 100).toFixed(0)}`}>
                        <div className="rli-chart-bar" style={{ height: `${pct}%`, background: col }} />
                        <span className="rli-chart-lbl">{wk.week.split('-W')[1] ? `W${wk.week.split('-W')[1]}` : wk.week}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="rli-curve-foot">
                  <span>Exploration rate: {(learning_curve.exploration_rate * 100).toFixed(1)}%</span>
                  <span className="rli-curve-hint">(decreases as the AI learns you)</span>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
