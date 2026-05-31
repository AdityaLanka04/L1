import { useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { getRateLimitMessage } from '../utils/rateLimitHandler';

export default function RateLimitHandler() {
  const { showToast } = useToast();

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

  return null;
}
