/**
 * useMasterAgent Hook
 * React hook for accessing Master Agent learning insights
 */

import { useState, useCallback, useEffect } from 'react';
import masterAgentService from '../services/masterAgentService';

/**
 * Hook for accessing Master Agent learning insights
 * @param {string} userId - User ID to fetch data for
 * @param {boolean} autoFetch - Whether to fetch data on mount
 */
const useMasterAgent = (userId, autoFetch = false) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [weakTopics, setWeakTopics] = useState(null);
  const [strongTopics, setStrongTopics] = useState(null);
  const [insights, setInsights] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [dashboard, setDashboard] = useState(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) return null;
    try {
      const data = await masterAgentService.getUserProfile(userId);
      setProfile(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      return null;
    }
  }, [userId]);

  const fetchWeakTopics = useCallback(async () => {
    if (!userId) return null;
    try {
      const data = await masterAgentService.getWeakTopics(userId);
      setWeakTopics(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch weak topics:', err);
      return null;
    }
  }, [userId]);

  const fetchStrongTopics = useCallback(async () => {
    if (!userId) return null;
    try {
      const data = await masterAgentService.getStrongTopics(userId);
      setStrongTopics(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch strong topics:', err);
      return null;
    }
  }, [userId]);

  const fetchInsights = useCallback(async () => {
    if (!userId) return null;
    try {
      const data = await masterAgentService.getLearningInsights(userId);
      setInsights(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch insights:', err);
      return null;
    }
  }, [userId]);

  const fetchRecommendations = useCallback(async () => {
    if (!userId) return null;
    try {
      const data = await masterAgentService.getRecommendations(userId);
      setRecommendations(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
      return null;
    }
  }, [userId]);

  const fetchDashboard = useCallback(async () => {
    if (!userId) return null;
    setLoading(true);
    setError(null);
    try {
      const data = await masterAgentService.getDashboard(userId);
      setDashboard(data);
      return data;
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch dashboard:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchAll = useCallback(async () => {
    if (!userId) return null;
    setLoading(true);
    setError(null);
    try {
      const data = await masterAgentService.getComprehensiveLearningData(userId);
      setProfile(data.profile);
      setWeakTopics(data.weakTopics);
      setStrongTopics(data.strongTopics);
      setInsights(data.insights);
      setRecommendations(data.recommendations);
      return data;
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch all data:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (autoFetch && userId) {
      fetchDashboard();
    }
  }, [autoFetch, userId, fetchDashboard]);

  return {
    loading,
    error,
    profile,
    weakTopics,
    strongTopics,
    insights,
    recommendations,
    dashboard,
    fetchProfile,
    fetchWeakTopics,
    fetchStrongTopics,
    fetchInsights,
    fetchRecommendations,
    fetchDashboard,
    fetchAll
  };
};

export default useMasterAgent;
