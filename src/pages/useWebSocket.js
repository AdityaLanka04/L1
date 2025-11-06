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
      console.warn('⚠️ No token provided to WebSocket');
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
    console.log('🔌 Connecting to WebSocket:', wsEndpoint.replace(token, 'TOKEN_HIDDEN'));

    try {
      ws.current = new WebSocket(wsEndpoint);

      ws.current.onopen = () => {
        console.log('✅ WebSocket Connected');
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
          console.log('📨 WebSocket message received:', data.type);
          
          if (onMessage) {
            onMessage(data);
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      ws.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        console.error('❌ WebSocket readyState:', ws.current?.readyState);
        setIsConnected(false);
      };

      ws.current.onclose = (event) => {
        console.log('🔌 WebSocket Disconnected. Code:', event.code, 'Reason:', event.reason);
        setIsConnected(false);

        // Don't reconnect if it's an authentication error (1008)
        if (event.code === 1008) {
          console.error('❌ Authentication failed. Token may be invalid or expired.');
          return;
        }

        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`🔄 Reconnecting in ${delay}ms... (Attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeout.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else {
          console.error('❌ Max reconnection attempts reached');
        }
      };
    } catch (error) {
      console.error('❌ Error creating WebSocket:', error);
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
        console.log('🧹 Cleaning up WebSocket connection');
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
        console.log('🏓 Ping sent');
      }
    }, 30000);

    return () => clearInterval(pingInterval);
  }, [isConnected]);

  const sendMessage = (message) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      console.warn('⚠️ WebSocket not connected, queuing message');
      messageQueue.current.push(message);
    }
  };

  return { isConnected, sendMessage };
};

export default useWebSocket;