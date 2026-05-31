

let _installed = false;

export function installFetchInterceptor() {
  if (_installed || typeof window === 'undefined') return;
  _installed = true;

  const _originalFetch = window.fetch.bind(window);

  window.fetch = async function interceptedFetch(input, init) {
    const response = await _originalFetch(input, init);

    if (response.status === 429) {
      const retryAfter = parseInt(
        response.headers.get('Retry-After') || '60',
        10
      );
      const tier = response.headers.get('X-RateLimit-Tier') || 'unknown';
      const limit = response.headers.get('X-RateLimit-Limit');
      const window_ = response.headers.get('X-RateLimit-Window');

      const url =
        typeof input === 'string'
          ? input
          : input instanceof Request
          ? input.url
          : String(input);

      window.dispatchEvent(
        new CustomEvent('brainwave:rate-limited', {
          detail: { retryAfter, tier, limit: parseInt(limit, 10), window: parseInt(window_, 10), url },
        })
      );
    }

    return response;
  };
}
