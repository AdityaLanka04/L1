import { useEffect, useRef, useState } from 'react';

const useWebSocket = (token, onMessage) => {
  const ws = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeout = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const messageQueue = useRef([]);

  const connect = () => {
    if (!token) {
            return;
    }

    // Determine WebSocket URL based on environment
    let wsUrl;
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    
    // Convert HTTP/HTTPS to WS/WSS
    if (API_URL.includes('localhost')) {
      wsUrl = API_URL.replace('http://', 'ws://').replace('https://', 'ws://');
    } else {
      // Production - use WSS for secure WebSocket
      wsUrl = API_URL.replace('http://', 'wss://').replace('https://', 'wss://');
    }
    
    // Remove /api suffix if present
    wsUrl = wsUrl.replace('/api', '');
    
    const wsEndpoint = `${wsUrl}/ws?token=${encodeURIComponent(token)}`;
    );

    try {
      ws.current = new WebSocket(wsEndpoint);

      ws.current.onopen = () => {
                setIsConnected(true);
        reconnectAttempts.current = 0;

        // Send any queued messages
        while (messageQueue.current.length > 0) {
          const msg = messageQueue.current.shift();
          ws.current.send(JSON.stringify(msg));
        }
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
                    
          if (onMessage) {
            onMessage(data);
          }
        } catch (error) {
                  }
      };

      ws.current.onerror = (error) => {
                        setIsConnected(false);
      };

      ws.current.onclose = (event) => {
                setIsConnected(false);

        // Don't reconnect if it's an authentication error (1008)
        if (event.code === 1008) {
                    return;
        }

        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          `);
          
          reconnectTimeout.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else {
                  }
      };
    } catch (error) {
          }
  };

  useEffect(() => {
    if (token) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.close(1000, 'Component unmounting');
      }
    };
  }, [token]);

  // Keepalive ping every 30 seconds
  useEffect(() => {
    if (!isConnected) return;

    const pingInterval = setInterval(() => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'ping' }));
              }
    }, 30000);

    return () => clearInterval(pingInterval);
  }, [isConnected]);

  const sendMessage = (message) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
            messageQueue.current.push(message);
    }
  };

  return { isConnected, sendMessage };
};

export default useWebSocket;