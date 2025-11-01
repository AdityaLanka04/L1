// src/config/api.js

/**
 * API Configuration
 * Handles API URL based on environment
 */

const getApiUrl = () => {
  // In production, use same domain (empty string)
  // In development, use localhost from environment variable
  return process.env.REACT_APP_API_URL || '';
};

export const API_URL = getApiUrl();

/**
 * Helper function for making authenticated API requests
 */
export const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_URL}${endpoint}`;
  
  // Get token from localStorage
  const token = localStorage.getItem('token');
  
  const defaultHeaders = {
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Request to ${endpoint} failed:`, error);
    throw error;
  }
};

/**
 * Authentication token helpers
 */
export const getAuthToken = () => {
  return localStorage.getItem('token');
};

export const setAuthToken = (token) => {
  localStorage.setItem('token', token);
};

export const removeAuthToken = () => {
  localStorage.removeItem('token');
};

export const isAuthenticated = () => {
  return !!getAuthToken();
};