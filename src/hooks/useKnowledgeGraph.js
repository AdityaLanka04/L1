/**
 * useKnowledgeGraph Hook
 * React hook for accessing Knowledge Graph data
 */

import { useState, useCallback, useEffect } from 'react';
import knowledgeGraphService from '../services/knowledgeGraphService';

/**
 * Hook for accessing Knowledge Graph data
 * @param {string} userId - User ID to fetch data for
 * @param {boolean} autoFetch - Whether to fetch data on mount
 */
const useKnowledgeGraph = (userId, autoFetch = false) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [conceptMastery, setConceptMastery] = useState(null);
  const [weakConcepts, setWeakConcepts] = useState(null);
  const [strongConcepts, setStrongConcepts] = useState(null);
  const [domainMastery, setDomainMastery] = useState(null);
  const [knowledgeGaps, setKnowledgeGaps] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [recommendedTopics, setRecommendedTopics] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await knowledgeGraphService.getStatus();
      setStatus(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch KG status:', err);
      return null;
    }
  }, []);

  const fetchConceptMastery = useCallback(async (limit = 50) => {
    if (!userId) return null;
    try {
      const data = await knowledgeGraphService.getConceptMastery(userId, limit);
      setConceptMastery(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch concept mastery:', err);
      return null;
    }
  }, [userId]);

  const fetchWeakConcepts = useCallback(async (threshold = 0.5, limit = 10) => {
    if (!userId) return null;
    try {
      const data = await knowledgeGraphService.getWeakConcepts(userId, threshold, limit);
      setWeakConcepts(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch weak concepts:', err);
      return null;
    }
  }, [userId]);

  const fetchStrongConcepts = useCallback(async (threshold = 0.7, limit = 10) => {
    if (!userId) return null;
    try {
      const data = await knowledgeGraphService.getStrongConcepts(userId, threshold, limit);
      setStrongConcepts(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch strong concepts:', err);
      return null;
    }
  }, [userId]);

  const fetchDomainMastery = useCallback(async () => {
    if (!userId) return null;
    try {
      const data = await knowledgeGraphService.getDomainMastery(userId);
      setDomainMastery(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch domain mastery:', err);
      return null;
    }
  }, [userId]);

  const fetchKnowledgeGaps = useCallback(async (limit = 10) => {
    if (!userId) return null;
    try {
      const data = await knowledgeGraphService.getKnowledgeGaps(userId, limit);
      setKnowledgeGaps(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch knowledge gaps:', err);
      return null;
    }
  }, [userId]);

  const fetchAnalytics = useCallback(async (days = 30) => {
    if (!userId) return null;
    try {
      const data = await knowledgeGraphService.getLearningAnalytics(userId, days);
      setAnalytics(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      return null;
    }
  }, [userId]);

  const fetchRecommendedTopics = useCallback(async (limit = 5) => {
    if (!userId) return null;
    try {
      const data = await knowledgeGraphService.getRecommendedTopics(userId, limit);
      setRecommendedTopics(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch recommended topics:', err);
      return null;
    }
  }, [userId]);

  const getLearningPath = useCallback(async (topic, maxConcepts = 10) => {
    if (!userId) return null;
    try {
      return await knowledgeGraphService.getLearningPath(userId, topic, maxConcepts);
    } catch (err) {
      console.error('Failed to get learning path:', err);
      return null;
    }
  }, [userId]);

  const recordInteraction = useCallback(async (concept, correct, source = 'flashcard', difficulty = 0.5) => {
    if (!userId) return null;
    try {
      return await knowledgeGraphService.recordConceptInteraction(userId, concept, correct, source, difficulty);
    } catch (err) {
      console.error('Failed to record interaction:', err);
      return null;
    }
  }, [userId]);

  const getRelatedConcepts = useCallback(async (concept, limit = 10) => {
    try {
      return await knowledgeGraphService.getRelatedConcepts(concept, userId, limit);
    } catch (err) {
      console.error('Failed to get related concepts:', err);
      return null;
    }
  }, [userId]);

  const fetchAll = useCallback(async () => {
    if (!userId) return null;
    setLoading(true);
    setError(null);
    try {
      const [statusData, masteryData, weakData, strongData, domainData, gapsData, analyticsData, topicsData] = 
        await Promise.all([
          fetchStatus(),
          fetchConceptMastery(),
          fetchWeakConcepts(),
          fetchStrongConcepts(),
          fetchDomainMastery(),
          fetchKnowledgeGaps(),
          fetchAnalytics(),
          fetchRecommendedTopics()
        ]);
      
      return {
        status: statusData,
        conceptMastery: masteryData,
        weakConcepts: weakData,
        strongConcepts: strongData,
        domainMastery: domainData,
        knowledgeGaps: gapsData,
        analytics: analyticsData,
        recommendedTopics: topicsData
      };
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch all KG data:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId, fetchStatus, fetchConceptMastery, fetchWeakConcepts, fetchStrongConcepts, 
      fetchDomainMastery, fetchKnowledgeGaps, fetchAnalytics, fetchRecommendedTopics]);

  useEffect(() => {
    if (autoFetch && userId) {
      fetchAll();
    }
  }, [autoFetch, userId, fetchAll]);

  return {
    loading,
    error,
    status,
    conceptMastery,
    weakConcepts,
    strongConcepts,
    domainMastery,
    knowledgeGaps,
    analytics,
    recommendedTopics,
    fetchStatus,
    fetchConceptMastery,
    fetchWeakConcepts,
    fetchStrongConcepts,
    fetchDomainMastery,
    fetchKnowledgeGaps,
    fetchAnalytics,
    fetchRecommendedTopics,
    getLearningPath,
    recordInteraction,
    getRelatedConcepts,
    fetchAll
  };
};

export default useKnowledgeGraph;
