export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export const apiRequest = async (endpoint, options = {}) => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const url = `${API_URL}/${cleanEndpoint}`;
  const token = localStorage.getItem('token');

  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };

  const response = await fetch(url, {
    ...options,
    headers: { ...defaultHeaders, ...options.headers },
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userProfile');
    window.location.href = '/login';
    throw new Error('Session expired. Please login again.');
  }

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
    const tier = response.headers.get('X-RateLimit-Tier') || 'unknown';
    const limit = response.headers.get('X-RateLimit-Limit');
    const windowSecs = response.headers.get('X-RateLimit-Window');
    const err = new Error(`Rate limit exceeded. Please wait ${retryAfter} second(s).`);
    err.isRateLimit = true;
    err.retryAfter = retryAfter;
    err.tier = tier;
    err.limit = parseInt(limit, 10);
    err.window = parseInt(windowSecs, 10);
    throw err;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

export const getAuthToken = () => localStorage.getItem('token');
export const setAuthToken = (token) => localStorage.setItem('token', token);
export const removeAuthToken = () => localStorage.removeItem('token');
export const isAuthenticated = () => !!getAuthToken();
