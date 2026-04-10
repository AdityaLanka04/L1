import { useState, useEffect } from 'react';
import { Brain, TrendingUp, Zap, Target, BarChart3, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import './RLInsights.css';
import { API_URL } from '../../config';

const STRATEGY_LABELS = {
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

const STRATEGY_ICONS = {
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

function RewardBar({ value, showLabel = true }) {
  const pct = Math.max(0, Math.min(100, ((value + 1) / 2) * 100));
  const color = value > 0.2 ? 'var(--accent)' : value > -0.1 ? '#f59e0b' : '#ef4444';
  return (
    <div className="rli-reward-bar">
      <div className="rli-reward-track">
        <div className="rli-reward-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      {showLabel && <span className="rli-reward-label" style={{ color }}>{value > 0 ? '+' : ''}{(value * 100).toFixed(0)}</span>}
    </div>
  );
}

function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100);
  return (
    <div className="rli-confidence-bar">
      <div className="rli-confidence-track">
        <div className="rli-confidence-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="rli-confidence-label">{pct}%</span>
    </div>
  );
}

export default function RLInsights({ userName, token, isAdmin = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedStrategy, setExpandedStrategy] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!userName || !token) return;
    loadData();
  }, [userName]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/intelligence/rl/strategy-performance/${userName}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError('Could not load RL insights. Keep using Cerbyl to generate data!');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="rli-container rli-loading">
        <Brain size={32} className="rli-spin" />
        <p>Loading how you learn best…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rli-container rli-empty">
        <Brain size={40} />
        <h3>Your AI tutor is still learning about you</h3>
        <p>{error || 'Keep chatting to unlock personalized insights.'}</p>
        <button className="rli-refresh-btn" onClick={loadData}><RefreshCw size={14} /> Refresh</button>
      </div>
    );
  }

  const { strategy_stats, top_policy, learning_curve, overall_stats } = data;
  const totalInteractions = overall_stats?.total_interactions_with_rl || 0;
  const hasEnoughData = totalInteractions >= 10;

  return (
    <div className="rli-container">
      <div className="rli-header">
        <div className="rli-title">
          <Brain size={20} />
          <h3>How You Learn Best</h3>
        </div>
        <div className="rli-header-right">
          <span className="rli-interactions-badge">{totalInteractions} interactions tracked</span>
          <button className="rli-refresh-btn" onClick={loadData}><RefreshCw size={13} /></button>
        </div>
      </div>

      {!hasEnoughData && (
        <div className="rli-warmup-banner">
          <Zap size={14} />
          <span>Your AI tutor needs ~10 conversations to learn your patterns. Keep going!</span>
        </div>
      )}

      <div className="rli-tabs">
        {['overview', 'strategies', 'policy', 'curve'].map(tab => (
          <button
            key={tab}
            className={`rli-tab ${activeTab === tab ? 'rli-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'overview' && 'Overview'}
            {tab === 'strategies' && 'Strategies'}
            {tab === 'policy' && 'Learned Policy'}
            {tab === 'curve' && 'Learning Curve'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="rli-overview">
          <div className="rli-stat-grid">
            <div className="rli-stat-card">
              <div className="rli-stat-icon rli-stat-icon--blue"><Target size={16} /></div>
              <div className="rli-stat-body">
                <div className="rli-stat-value">{overall_stats?.most_effective_strategy ? STRATEGY_LABELS[overall_stats.most_effective_strategy] || overall_stats.most_effective_strategy : '—'}</div>
                <div className="rli-stat-label">Most effective teaching style</div>
              </div>
            </div>
            <div className="rli-stat-card">
              <div className="rli-stat-icon rli-stat-icon--green"><TrendingUp size={16} /></div>
              <div className="rli-stat-body">
                <div className="rli-stat-value">{overall_stats?.improvement_vs_rules >= 0 ? '+' : ''}{((overall_stats?.improvement_vs_rules || 0) * 100).toFixed(1)}%</div>
                <div className="rli-stat-label">Improvement vs rule-based teaching</div>
              </div>
            </div>
            <div className="rli-stat-card">
              <div className="rli-stat-icon rli-stat-icon--purple"><BarChart3 size={16} /></div>
              <div className="rli-stat-body">
                <div className="rli-stat-value">{((overall_stats?.avg_reward_all_time || 0) * 100).toFixed(0)}</div>
                <div className="rli-stat-label">Average reward score</div>
              </div>
            </div>
          </div>

          {top_policy?.length > 0 && (
            <div className="rli-insights-list">
              <h4>What your tutor has figured out:</h4>
              {top_policy.slice(0, 5).map((p, i) => (
                p.pulls >= 5 && (
                  <div key={i} className="rli-insight-row">
                    <span className="rli-insight-icon">{STRATEGY_ICONS[p.best_strategy] || '📚'}</span>
                    <div className="rli-insight-text">
                      <span className="rli-insight-state">{p.state_description}</span>
                      <span className="rli-insight-arrow">→</span>
                      <span className="rli-insight-strategy">{STRATEGY_LABELS[p.best_strategy] || p.best_strategy}</span>
                    </div>
                    <ConfidenceBar value={p.confidence} />
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'strategies' && (
        <div className="rli-strategies">
          {strategy_stats
            ?.filter(s => s.total_pulls > 0)
            .sort((a, b) => b.avg_reward - a.avg_reward)
            .map(s => (
              <div key={s.strategy_id} className="rli-strategy-card">
                <button
                  className="rli-strategy-header"
                  onClick={() => setExpandedStrategy(expandedStrategy === s.strategy_id ? null : s.strategy_id)}
                >
                  <span className="rli-strategy-icon">{STRATEGY_ICONS[s.strategy_id] || '📚'}</span>
                  <span className="rli-strategy-name">{STRATEGY_LABELS[s.strategy_id] || s.strategy_id}</span>
                  <div className="rli-strategy-meta">
                    <span className="rli-strategy-pulls">{s.total_pulls} uses</span>
                    <RewardBar value={s.avg_reward} />
                  </div>
                  {expandedStrategy === s.strategy_id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {expandedStrategy === s.strategy_id && (
                  <div className="rli-strategy-detail">
                    <div className="rli-strategy-stats">
                      <div className="rli-strategy-stat">
                        <span>Win rate</span>
                        <strong>{(s.win_rate * 100).toFixed(0)}%</strong>
                      </div>
                      <div className="rli-strategy-stat">
                        <span>Avg reward</span>
                        <strong>{s.avg_reward > 0 ? '+' : ''}{(s.avg_reward * 100).toFixed(0)}</strong>
                      </div>
                    </div>
                    {s.best_states?.length > 0 && (
                      <div className="rli-strategy-states">
                        <span className="rli-states-label">Works best when:</span>
                        <div className="rli-states-list">
                          {s.best_states.map((st, i) => <span key={i} className="rli-state-chip rli-state-chip--good">{st}</span>)}
                        </div>
                      </div>
                    )}
                    {s.worst_states?.length > 0 && (
                      <div className="rli-strategy-states">
                        <span className="rli-states-label">Less effective when:</span>
                        <div className="rli-states-list">
                          {s.worst_states.map((st, i) => <span key={i} className="rli-state-chip rli-state-chip--bad">{st}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {activeTab === 'policy' && (
        <div className="rli-policy">
          {top_policy?.length === 0 ? (
            <div className="rli-policy-empty">
              <p>Not enough data yet. The bandit learns after ~20 interactions.</p>
            </div>
          ) : (
            <div className="rli-policy-table">
              <div className="rli-policy-header-row">
                <span>When you are…</span>
                <span>Best approach</span>
                <span>Confidence</span>
                <span>Tested</span>
              </div>
              {top_policy.map((p, i) => (
                <div key={i} className="rli-policy-row">
                  <span className="rli-policy-state">{p.state_description}</span>
                  <span className="rli-policy-strategy">
                    <span>{STRATEGY_ICONS[p.best_strategy] || '📚'}</span>
                    {STRATEGY_LABELS[p.best_strategy] || p.best_strategy}
                  </span>
                  <ConfidenceBar value={p.confidence} />
                  <span className="rli-policy-pulls">{p.pulls}×</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'curve' && (
        <div className="rli-curve">
          {learning_curve?.avg_reward_by_week?.length === 0 ? (
            <p className="rli-curve-empty">No weekly data yet — keep learning!</p>
          ) : (
            <>
              <div className="rli-chart">
                {learning_curve.avg_reward_by_week.map((wk, i) => {
                  const pct = Math.max(5, Math.min(100, ((wk.avg_reward + 1) / 2) * 100));
                  return (
                    <div key={i} className="rli-chart-bar-wrap" title={`Week ${wk.week}: ${(wk.avg_reward * 100).toFixed(0)}`}>
                      <div
                        className="rli-chart-bar"
                        style={{ height: `${pct}%`, background: wk.avg_reward > 0.1 ? 'var(--accent)' : '#f59e0b' }}
                      />
                      <span className="rli-chart-label">{wk.week.split('-W')[1] ? `W${wk.week.split('-W')[1]}` : wk.week}</span>
                    </div>
                  );
                })}
              </div>
              <div className="rli-curve-meta">
                <span>Exploration rate: {(learning_curve.exploration_rate * 100).toFixed(1)}%</span>
                <span className="rli-curve-hint">(should decrease over time as the bandit learns)</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
