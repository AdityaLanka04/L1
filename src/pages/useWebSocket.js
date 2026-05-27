import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_RECONNECT_ATTEMPTS = 5;

const useWebSocket = (token, onMessage) => {
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const messageQueueRef = useRef([]);
  const [isConnected, setIsConnected] = useState(false);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const buildEndpoint = useCallback(() => {
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    let wsUrl = apiUrl.replace('http://', 'ws://').replace('https://', 'wss://');

    if (apiUrl.includes('localhost')) {
      wsUrl = wsUrl.replace('wss://', 'ws://');
    }

    wsUrl = wsUrl.replace('/api', '');
    return `${wsUrl}/ws?token=${encodeURIComponent(token)}`;
  }, [token]);

  const connect = useCallback(() => {
    if (!token) {
      return;
    }

    clearReconnectTimeout();

    try {
      socketRef.current = new WebSocket(buildEndpoint());
    } catch (error) {
      setIsConnected(false);
      return;
    }

    socketRef.current.onopen = () => {
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;

      while (messageQueueRef.current.length > 0 && socketRef.current?.readyState === WebSocket.OPEN) {
        const queued = messageQueueRef.current.shift();
        socketRef.current.send(JSON.stringify(queued));
      }
    };

    socketRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onMessage) {
          onMessage(data);
        }
      } catch (error) {
        // ignore malformed payloads
      }
    };

    socketRef.current.onerror = () => {
      setIsConnected(false);
    };

    socketRef.current.onclose = (event) => {
      setIsConnected(false);

      if (event.code === 1008) {
        return;
      }

      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        return;
      }

      const delayMs = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000);
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectAttemptsRef.current += 1;
        connect();
      }, delayMs);
    };
  }, [buildEndpoint, clearReconnectTimeout, onMessage, token]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    connect();

    return () => {
      clearReconnectTimeout();
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close(1000, 'Component unmounting');
      }
      socketRef.current = null;
    };
  }, [clearReconnectTimeout, connect, token]);

  useEffect(() => {
    if (!isConnected) {
      return undefined;
    }

    const pingInterval = setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => clearInterval(pingInterval);
  }, [isConnected]);

  const sendMessage = useCallback((message) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      return;
    }

    messageQueueRef.current.push(message);
  }, []);

  return { isConnected, sendMessage };
};

export default useWebSocket;
