/**
 * API Configuration
 */

//  In production (Vercel), this will be: https://ceryl.onrender.com/api
//  In development, this will be: http://localhost:8000/api
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';


/**
 * Helper function for making authenticated API requests
 */
export const apiRequest = async (endpoint, options = {}) => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const url = `${API_URL}/${cleanEndpoint}`;
  
    
  const token = localStorage.getItem('token');
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    // Handle expired token - auto logout
    if (response.status === 401) {
            localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('userProfile');
      sessionStorage.removeItem('safetyAccepted');
      window.location.href = '/login';
      throw new Error('Session expired. Please login again.');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
        throw error;
  }
};

// Auth helpers
export const getAuthToken = () => localStorage.getItem('token');
export const setAuthToken = (token) => localStorage.setItem('token', token);
export const removeAuthToken = () => localStorage.removeItem('token');
export const isAuthenticated = () => !!getAuthToken();