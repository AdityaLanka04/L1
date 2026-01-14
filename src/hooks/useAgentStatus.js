/**
 * useAgentStatus Hook
 * React hook for checking agent system status
 */

import { useState, useCallback, useEffect } from 'react';
import { API_URL, getAuthToken } from '../config';

/**
 * Hook for checking agent system status
 * @param {boolean} autoFetch - Whether to fetch status on mount
 */
const useAgentStatus = (autoFetch = true) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [isHealthy, setIsHealthy] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_URL}/agents/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get agent status: ${response.status}`);
      }

      const data = await response.json();
      setStatus(data);
      setIsHealthy(data.status === 'healthy');
      return data;
    } catch (err) {
      setError(err.message);
      setIsHealthy(false);
      console.error('Failed to fetch agent status:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchStatus();
    }
  }, [autoFetch, fetchStatus]);

  return {
    loading,
    error,
    status,
    isHealthy,
    agents: status?.agents || {},
    capabilities: status?.capabilities || [],
    toolsAvailable: status?.tools_available || 0,
    knowledgeGraphConnected: status?.knowledge_graph_connected || false,
    fetchStatus,
    refresh: fetchStatus
  };
};

export default useAgentStatus;
