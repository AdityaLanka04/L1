import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, X } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { getRateLimitMessage } from '../utils/rateLimitHandler';
import './RateLimitHandler.css';

const formatTokens = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toLocaleString();
};

export default function RateLimitHandler() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [tokenLimit, setTokenLimit] = useState(null);

  const utilizationPct = useMemo(() => {
    if (!tokenLimit?.includedTokens) return 100;
    return Math.max(0, Math.min(100, Math.round((Number(tokenLimit.usedTokens || 0) / Number(tokenLimit.includedTokens || 1)) * 100)));
  }, [tokenLimit]);

  useEffect(() => {
    function handleRateLimit(event) {
      const { retryAfter, tier, limit, window: windowSecs } = event.detail;
      const message = getRateLimitMessage({ retryAfter, tier, limit, window: windowSecs });

      showToast({
        notification_type: 'quiz_poor_performance',
        title: 'Rate limit reached',
        message,
      });
    }

    window.addEventListener('brainwave:rate-limited', handleRateLimit);
    return () => window.removeEventListener('brainwave:rate-limited', handleRateLimit);
  }, [showToast]);

  useEffect(() => {
    function handleTokenLimit(event) {
      setTokenLimit({
        currentPlanName: event.detail?.currentPlanName || 'Current plan',
        usedTokens: Number(event.detail?.usedTokens || 0),
        includedTokens: Number(event.detail?.includedTokens || 0),
        windowDays: Number(event.detail?.windowDays || 30),
        message: event.detail?.message || 'You have used all AI tokens for this plan.',
      });
    }

    window.addEventListener('brainwave:token-limit-exceeded', handleTokenLimit);
    return () => window.removeEventListener('brainwave:token-limit-exceeded', handleTokenLimit);
  }, []);

  if (!tokenLimit) return null;

  const close = () => setTokenLimit(null);
  const upgrade = () => {
    close();
    navigate('/profile?upgrade=1');
  };

  return (
    <div className="token-limit-backdrop" role="presentation">
      <div className="token-limit-modal" role="dialog" aria-modal="true" aria-labelledby="token-limit-title">
        <button className="token-limit-close" type="button" onClick={close} aria-label="Close">
          <X size={18} />
        </button>

        <div className="token-limit-kicker">AI tokens exhausted</div>
        <h2 id="token-limit-title">Upgrade to keep using AI</h2>
        <p>
          Your {tokenLimit.currentPlanName} token allowance is used for this {tokenLimit.windowDays}-day window.
          Upgrade your plan to continue generating answers, notes, quizzes, and media analysis.
        </p>

        <div className="token-limit-meter" aria-label={`${utilizationPct}% of tokens used`}>
          <div className="token-limit-meter-fill" style={{ width: `${utilizationPct}%` }} />
        </div>

        <div className="token-limit-stats">
          <span>{formatTokens(tokenLimit.usedTokens)} used</span>
          <span>{formatTokens(tokenLimit.includedTokens)} included</span>
        </div>

        <div className="token-limit-actions">
          <button className="token-limit-secondary" type="button" onClick={close}>
            Not now
          </button>
          <button className="token-limit-primary" type="button" onClick={upgrade}>
            Upgrade <ArrowUpRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
