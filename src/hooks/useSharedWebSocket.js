import { useEffect, useState, useRef } from 'react';
import wsManager from '../utils/WebSocketManager';

/**
 * Hook to use shared WebSocket connection
 * All components using this hook share the same WebSocket connection
 */
const useSharedWebSocket = (token, onMessage, componentId) => {
  const [isConnected, setIsConnected] = useState(false);
  const listenerIdRef = useRef(componentId || `component_${Math.random()}`);

  useEffect(() => {
    if (!token) {
            return;
    }

    const listenerId = listenerIdRef.current;
    
    // Connect if not already connected (manager prevents duplicates)
    wsManager.connect(token);

    // Subscribe to messages
    wsManager.subscribe(listenerId, (message) => {
      // Handle connection status
      if (message.type === '_connected') {
        setIsConnected(message.isConnected);
        return;
      }

      // Forward message to component
      if (onMessage) {
        onMessage(message);
      }
    });

    // Cleanup on unmount
    return () => {
            wsManager.unsubscribe(listenerId);
    };
  }, [token]); // Removed onMessage and componentId from dependencies to prevent reconnects

  const sendMessage = (message) => {
    wsManager.send(message);
  };

  return { isConnected, sendMessage };
};

export default useSharedWebSocket;
