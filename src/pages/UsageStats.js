import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { API_URL } from '../config';
import GeometricGrid from '../components/GeometricGrid';
import {
  PLAN_META,
  PLAN_FALLBACKS,
  FALLBACK_PLANS,
  withCurrentPlanCredits,
  formatUsd,
  formatTokens,
  getPlanPrice,
  getYearlySavingsPct,
  getYearlyEquivalentMonthly,
  PriceTicker,
  formatReset,
} from './ProfileNew';
import './ProfilePage.css';
import './UsageStats.css';

const TIER_GROUPS = [
  {
    label: 'Study & AI Usage',
    tiers: [
      { key: 'ai_heavy', label: 'AI Generation (flashcards, notes, quizzes, chat)' },
      { key: 'ai_light', label: 'AI Search & Suggestions' },
      { key: 'file_upload', label: 'File Uploads' },
      { key: 'write', label: 'Saves & Edits' },
      { key: 'read', label: 'Page Loads' },
    ],
  },
  {
    label: 'Account Security',
    tiers: [
      { key: 'auth_login', label: 'Login Attempts' },
      { key: 'auth_register', label: 'Registration Attempts' },
      { key: 'auth_social', label: 'Social Sign-In' },
    ],
  },
];

const formatWindow = (seconds) => {
  const n = Number(seconds || 0);
  if (n >= 3600) return `${Math.round(n / 3600)}h`;
  if (n >= 60) return `${Math.round(n / 60)}m`;
  return `${n}s`;
};

const meterTone = (pct) => (pct >= 90 ? ' is-danger' : pct >= 70 ? ' is-warn' : '');

const Meter = ({ label, count, pct, footLeft, footRight }) => (
  <div className="us-meter">
    <div className="us-meter-head">
      <span className="us-meter-label">{label}</span>
      <span className="us-meter-count">{count}</span>
    </div>
    <div className="us-meter-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className={`us-meter-fill${meterTone(pct)}`} style={{ width: `${pct}%` }} />
    </div>
    <div className="us-meter-foot"><span>{footLeft}</span><span>{footRight}</span></div>
  </div>
);

const UsageStats = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('username') || '';

  const [subscriptionData, setSubscriptionData] = useState({
    loading: true,
    saving: false,
    saveAction: null,
    error: null,
    currentPlanId: 'starter',
    billingCycle: 'monthly',
    plans: FALLBACK_PLANS,
    usage: null,
  });
  const [rateLimits, setRateLimits] = useState(null);
  const [rateLimitsError, setRateLimitsError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadOverview = useCallback(async () => {
    if (!userName) return;
    setSubscriptionData(prev => ({ ...prev, loading: true, error: null }));
    try {
      const resp = await fetch(`${API_URL}/subscription/overview?user_id=${encodeURIComponent(userName)}&include_usage=true`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!resp.ok) throw new Error(`Subscription overview failed: ${resp.status}`);
      const data = await resp.json();
      setSubscriptionData(prev => ({
        ...prev,
        loading: false,
        error: null,
        currentPlanId: data.currentPlanId || 'starter',
        billingCycle: data.billingCycle || 'monthly',
        plans: Array.isArray(data.plans) && data.plans.length ? data.plans.map(withCurrentPlanCredits) : FALLBACK_PLANS,
        usage: data.usage || null,
      }));
    } catch (e) {
      setSubscriptionData(prev => ({ ...prev, loading: false, error: 'Unable to load usage overview.' }));
    }
  }, [token, userName]);

  const loadRateLimits = useCallback(async () => {
    if (!token) return;
    try {
      const resp = await fetch(`${API_URL}/rate-limits/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) throw new Error(`Rate limit status failed: ${resp.status}`);
      setRateLimits(await resp.json());
      setRateLimitsError(null);
    } catch (e) {
      setRateLimitsError('Unable to load live usage right now.');
    }
  }, [token]);

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    loadOverview();
    loadRateLimits();
  }, [token, navigate, loadOverview, loadRateLimits]);

  const readApiError = async (resp, fallback) => {
    try {
      const payload = await resp.json();
      if (payload?.detail) return payload.detail;
    } catch (e) { /* silenced */ }
    return fallback;
  };

  const handleSelectPlan = async (planId) => {
    if (!userName || !planId || subscriptionData.saving || planId === subscriptionData.currentPlanId) return;
    setSubscriptionData(prev => ({ ...prev, saving: true, saveAction: 'plan', error: null }));
    try {
      const isFreePlan = planId === 'starter';
      const resp = await fetch(`${API_URL}/subscription/${isFreePlan ? 'select' : 'checkout'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          user_id: userName,
          tier: planId,
          billingCycle: subscriptionData.billingCycle || 'monthly',
          subscriptionStatus: 'active'
        })
      });
      if (!resp.ok) throw new Error(await readApiError(resp, 'Unable to switch plan right now.'));
      const data = await resp.json().catch(() => ({}));
      if (!isFreePlan) {
        const checkoutUrl = new URL(data.checkoutUrl || '');
        if (checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'checkout.stripe.com') {
          throw new Error('The payment provider returned an invalid checkout URL.');
        }
        window.location.assign(checkoutUrl.toString());
        return;
      }
      await Promise.all([loadOverview(), loadRateLimits()]);
    } catch (e) {
      setSubscriptionData(prev => ({ ...prev, error: e?.message || 'Unable to switch plan right now.' }));
    } finally {
      setSubscriptionData(prev => ({ ...prev, saving: false, saveAction: null }));
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([loadOverview(), loadRateLimits()]);
    setRefreshing(false);
  };

  const scrollToPlans = () => document.getElementById('usage-section-switch')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const activeBillingCycle = subscriptionData.billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const billingLabel = activeBillingCycle === 'yearly' ? '/yr' : '/mo';
  const currentPlanId = String(subscriptionData.currentPlanId || 'starter').trim().toLowerCase();
  const currentPlan = subscriptionData.plans.find(p => String(p.id || '').trim().toLowerCase() === currentPlanId) || PLAN_FALLBACKS[currentPlanId] || null;
  const currentPlanPrice = currentPlan ? getPlanPrice(currentPlan, activeBillingCycle) : 0;

  const usage = subscriptionData.usage || {};
  const includedTokens = Number(currentPlan?.included_tokens_monthly || 0);
  const totalTokens = Number(usage.total_tokens || 0);
  const tokenPct = includedTokens > 0 ? Math.min(100, Math.round((totalTokens / includedTokens) * 100)) : 0;
  const topTools = Array.isArray(usage.top_tools) ? usage.top_tools : [];
  const maxToolTokens = Math.max(1, ...topTools.map((tool) => Number(tool.tokens_used || 0)));

  return (
    <div className="pf-page">
      <div className="pf-bg-fx" aria-hidden="true">
        <div className="pf-bg-wash" />
        <div className="pf-bg-orb pf-bg-orb-1" />
        <div className="pf-bg-orb pf-bg-orb-2" />
        <GeometricGrid className="pf-bg-geo" linesClassName="pf-bg-geo-lines" numsClassName="pf-bg-geo-nums" />
        <div className="pf-bg-grain" />
        <div className="pf-bg-vignette" />
      </div>

      <Link className="pf-back" to="/profile"><ChevronLeft size={16} aria-hidden="true" />Profile</Link>
      <Link className="pf-back us-back-right" to="/dashboard-cerbyl">Dashboard<ChevronRight size={16} aria-hidden="true" /></Link>

      <main className="pnw-main">
        <div className="pnw-canvas">
          <section className="pnw-identity us-hero" id="usage-section-overview">
            <div className="pnw-identity-copy">
              <h1>Usage<span>.</span></h1>
              <p className="pnw-handle">
                {currentPlan
                  ? `${currentPlan.name} plan · ${formatUsd(currentPlanPrice)}${billingLabel}`
                  : `Starter plan · ${formatUsd(0)}/mo`}
              </p>
              <div className="pnw-identity-actions">
                <button type="button" className="pnw-primary-action" onClick={scrollToPlans}>
                  Switch plan <ChevronRight size={15} aria-hidden="true" />
                </button>
                <button type="button" className="pnw-secondary-action" onClick={refresh} disabled={refreshing || subscriptionData.loading}>
                  <RefreshCw size={14} aria-hidden="true" className={refreshing ? 'us-spin' : ''} /> {refreshing ? 'Refreshing' : 'Refresh'}
                </button>
              </div>
            </div>
          </section>

          {subscriptionData.error && <div className="pnw-inline-error" role="alert">{subscriptionData.error}</div>}

          <section className="pnw-status-band" aria-label="Usage summary">
            <div><span>Plan</span><strong>{currentPlan?.name || 'Starter'}</strong></div>
            <div><span>Tokens · 30d</span><strong>{formatTokens(totalTokens)}</strong></div>
            <div><span>AI requests · 30d</span><strong>{Number(usage.ai_requests || 0).toLocaleString()}</strong></div>
            <div><span>Plan utilization</span><strong>{includedTokens > 0 ? `${tokenPct}%` : '—'}</strong></div>
          </section>

          {includedTokens > 0 && (
            <section className="pnw-panel" id="usage-section-credits">
              <div className="pnw-section-heading">
                <div><h2>Monthly AI credits</h2></div>
                <small>Last 30 days · included with {currentPlan?.name || 'your plan'}</small>
              </div>
              <Meter
                label="Tokens used"
                count={`${formatTokens(totalTokens)} / ${formatTokens(includedTokens)}`}
                pct={tokenPct}
                footLeft={`${tokenPct}% used`}
                footRight="Resets monthly"
              />
            </section>
          )}

          {topTools.length > 0 && (
            <section className="pnw-panel" id="usage-section-tools">
              <div className="pnw-section-heading">
                <div><h2>Most used tools</h2></div>
                <small>Last 30 days</small>
              </div>
              <div className="us-meter-list">
                {topTools.map((tool) => (
                  <div key={tool.tool_name} className="us-meter">
                    <div className="us-meter-head">
                      <span className="us-meter-label">{tool.tool_name}</span>
                      <span className="us-meter-count">{tool.usage_count} calls · {formatTokens(tool.tokens_used)} tokens</span>
                    </div>
                    <div className="us-meter-track" aria-hidden="true">
                      <div className="us-meter-fill" style={{ width: `${Math.max(3, Math.round((Number(tool.tokens_used || 0) / maxToolTokens) * 100))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section id="usage-section-limits" className="us-limits">
            <div className="us-limits-head">
              <h2>Rate limits</h2>
              {rateLimits && <small>Plan: {rateLimits.plan} · resets automatically per window</small>}
            </div>
            {rateLimitsError && <div className="pnw-inline-error" role="alert">{rateLimitsError}</div>}
            {!rateLimits && !rateLimitsError && <div className="pnw-plan-loading" role="status">Loading live usage…</div>}

            {rateLimits && (
              <div className="us-limit-grid">
                {TIER_GROUPS.map((group) => (
                  <section key={group.label} className="pnw-panel">
                    <div className="pnw-section-heading">
                      <div><h2>{group.label}</h2></div>
                    </div>
                    <div className="us-meter-list">
                      {group.tiers.map(({ key, label }) => {
                        const t = rateLimits.tiers?.[key];
                        if (!t) return null;
                        if (t.limit === 'unlimited') {
                          return (
                            <div key={key} className="us-meter">
                              <div className="us-meter-head">
                                <span className="us-meter-label">{label}</span>
                                <span className="us-meter-count">Unlimited</span>
                              </div>
                            </div>
                          );
                        }
                        const pct = t.limit > 0 ? Math.min(100, Math.round((t.used / t.limit) * 100)) : 0;
                        const resetStr = t.reset_at > 0 ? formatReset(t.reset_at) : '—';
                        return (
                          <Meter
                            key={key}
                            label={label}
                            count={`${t.used} / ${t.limit} · ${formatWindow(t.window_seconds)} window`}
                            pct={pct}
                            footLeft={`${pct}% used`}
                            footRight={`Resets in ${resetStr}`}
                          />
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>

          <section className="pnw-panel" id="usage-section-switch">
            <div className="pnw-section-heading">
              <div><h2>Switch plan</h2></div>
            </div>
            <p className="us-note">
              <strong>Testing mode.</strong>{' '}
              Switching plans here updates your tier instantly with no payment &mdash; billing isn&apos;t wired up yet.
              Use this to see how usage limits change per plan.
            </p>

            {subscriptionData.loading ? (
              <div className="pnw-plan-loading" role="status">Loading plans…</div>
            ) : (
              <div className="pnw-plan-grid">
                {subscriptionData.plans.map((plan) => {
                  const meta = PLAN_META[plan.id] || PLAN_META.starter;
                  const Icon = meta.icon;
                  const isCurrent = currentPlanId === String(plan.id || '').trim().toLowerCase();
                  const planYearlySavingsPct = getYearlySavingsPct(plan);
                  const planYearlyEquivalentMonthly = getYearlyEquivalentMonthly(plan);
                  const planPrice = getPlanPrice(plan, activeBillingCycle);
                  return (
                    <article key={plan.id} className={`pnw-plan-card ${isCurrent ? 'is-current' : ''}`}>
                      {isCurrent && <i className="pnw-plan-card-current">Current</i>}
                      <span className="pnw-plan-card-icon"><Icon size={20} /></span>
                      <h3>{plan.name}</h3>
                      <div className="pnw-plan-card-price">
                        <PriceTicker amount={planPrice} />
                        <small>{billingLabel}</small>
                        {planYearlySavingsPct > 0 && activeBillingCycle === 'yearly' && (
                          <span className="us-save">Save {planYearlySavingsPct}%</span>
                        )}
                      </div>
                      <p className="pnw-plan-card-credits">Includes {formatTokens(plan.included_tokens_monthly)} monthly AI credits</p>
                      {activeBillingCycle === 'yearly' && planYearlyEquivalentMonthly > 0 && (
                        <p className="us-plan-note">~{formatUsd(planYearlyEquivalentMonthly)}/mo effective</p>
                      )}
                      <p className="us-plan-summary">{plan.summary || ''}</p>
                      <button
                        type="button"
                        onClick={() => handleSelectPlan(plan.id)}
                        disabled={isCurrent || subscriptionData.saving}
                      >
                        {isCurrent ? 'Current plan' : (subscriptionData.saveAction === 'plan' ? 'Switching…' : 'Switch plan (test)')}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default UsageStats;
