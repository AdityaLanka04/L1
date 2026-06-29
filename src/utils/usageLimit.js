const LIMIT_CODES = new Set([
  'ai_token_limit_exceeded',
  'ai_provider_limit_exceeded',
]);

export const USAGE_LIMIT_EVENT = 'cerbyl:usage-limit';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const pluralizeHours = (hours) => {
  const value = Math.max(1, Number(hours || 24));
  const rounded = Number.isInteger(value) ? value : Math.ceil(value);
  return `${rounded} hour${rounded === 1 ? '' : 's'}`;
};

export const formatUsageLimitMessage = (limit = {}) => {
  const seconds = toNumber(limit.resetAfterSeconds);
  const hours = toNumber(limit.resetAfterHours) ?? (seconds !== null ? seconds / 3600 : null);
  const hoursText = pluralizeHours(hours);
  return `You've reached your usage limit. Your messages will reset in ${hoursText}.`;
};

const normalizeLimitPayload = (payload = {}, headers = null) => {
  const detail = typeof payload.detail === 'object' && payload.detail !== null
    ? payload.detail
    : payload;
  const code = detail.code || payload.code || headers?.get?.('X-AI-Limit-Code');
  if (!LIMIT_CODES.has(code)) return null;

  const resetAfterSeconds =
    toNumber(detail.reset_after_seconds) ??
    toNumber(payload.reset_after_seconds) ??
    toNumber(headers?.get?.('X-AI-Limit-Reset-After')) ??
    toNumber(headers?.get?.('X-TokenLimit-Reset-After')) ??
    toNumber(headers?.get?.('Retry-After'));
  const resetAfterHours =
    toNumber(detail.reset_after_hours) ??
    toNumber(payload.reset_after_hours) ??
    (resetAfterSeconds !== null ? Math.round((resetAfterSeconds / 3600) * 10) / 10 : null);

  return {
    code,
    provider: detail.provider || payload.provider || null,
    resetAt:
      detail.reset_at ||
      payload.reset_at ||
      headers?.get?.('X-AI-Limit-Reset') ||
      headers?.get?.('X-TokenLimit-Reset') ||
      null,
    resetAfterSeconds,
    resetAfterHours,
  };
};

export const getUsageLimitFromResponse = async (response) => {
  if (!response || response.status !== 429) return null;
  const payload = await response.clone().json().catch(() => ({}));
  return normalizeLimitPayload(payload, response.headers);
};

export const createUsageLimitError = (limit) => {
  emitUsageLimit(limit);
  const error = new Error(formatUsageLimitMessage(limit));
  error.isUsageLimit = true;
  error.usageLimit = limit;
  return error;
};

export const throwIfUsageLimitResponse = async (response) => {
  const limit = await getUsageLimitFromResponse(response);
  if (limit) throw createUsageLimitError(limit);
};

export const getUsageLimitFromError = (error) => {
  if (error?.isUsageLimit) return error.usageLimit || {};
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  if (message.startsWith('{')) {
    try {
      return normalizeLimitPayload(JSON.parse(message));
    } catch {
      return null;
    }
  }
  return null;
};

export const isUsageLimitError = (error) => Boolean(getUsageLimitFromError(error));

export const emitUsageLimit = (limit = {}) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(USAGE_LIMIT_EVENT, { detail: limit }));
};

export const listenUsageLimit = (handler) => {
  if (typeof window === 'undefined') return () => {};
  const listener = (event) => handler(event.detail || {});
  window.addEventListener(USAGE_LIMIT_EVENT, listener);
  return () => window.removeEventListener(USAGE_LIMIT_EVENT, listener);
};

export const installUsageLimitFetchInterceptor = () => {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  if (window.__cerbylUsageLimitFetchInstalled) return;

  const originalFetch = window.fetch.bind(window);
  window.__cerbylUsageLimitFetchInstalled = true;
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    if (response?.status === 429) {
      getUsageLimitFromResponse(response)
        .then((limit) => {
          if (limit) emitUsageLimit(limit);
        })
        .catch(() => {});
    }
    return response;
  };
};
