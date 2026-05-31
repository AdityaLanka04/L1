

const TIER_LABELS = {
  auth_login:    'Login',
  auth_register: 'Registration',
  auth_social:   'Social login',
  ai_heavy:      'AI generation',
  ai_light:      'AI search',
  file_upload:   'File upload',
  write:         'Requests',
  read:          'Requests',
  unknown:       'Requests',
};

export function getRateLimitMessage({ retryAfter, tier, limit, window: windowSecs }) {
  const label = TIER_LABELS[tier] || 'Requests';
  const windowLabel =
    windowSecs >= 3600
      ? `${windowSecs / 3600} hour${windowSecs / 3600 !== 1 ? 's' : ''}`
      : `${windowSecs} second${windowSecs !== 1 ? 's' : ''}`;

  if (retryAfter <= 5) {
    return `${label} limit reached. Try again in a moment.`;
  }
  if (retryAfter < 60) {
    return `${label} limit reached. Please wait ${retryAfter} seconds.`;
  }
  const mins = Math.ceil(retryAfter / 60);
  return `${label} limit reached (${limit} per ${windowLabel}). Try again in ~${mins} minute${mins !== 1 ? 's' : ''}.`;
}

export async function parseRateLimitResponse(response) {
  const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
  const tier = response.headers.get('X-RateLimit-Tier') || 'unknown';
  const limit = parseInt(response.headers.get('X-RateLimit-Limit') || '0', 10);
  const window_ = parseInt(response.headers.get('X-RateLimit-Window') || '3600', 10);

  let detail = '';
  try {
    const body = await response.json();
    detail = body.detail || '';
  } catch (_) {}

  return {
    isRateLimit: true,
    retryAfter,
    tier,
    limit,
    window: window_,
    message: detail || getRateLimitMessage({ retryAfter, tier, limit, window: window_ }),
  };
}
