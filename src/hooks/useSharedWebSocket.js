import { useEffect, useState, useRef } from 'react';
import wsManager from '../utils/WebSocketManager';

const useSharedWebSocket = (token, onMessage, componentId) => {
  const [isConnected, setIsConnected] = useState(false);
  const listenerIdRef = useRef(componentId || `component_${Math.random()}`);

  useEffect(() => {
    if (!token) {
            return;
    }

    const listenerId = listenerIdRef.current;
    
    
    wsManager.connect(token);

    
    wsManager.subscribe(listenerId, (message) => {
      
      if (message.type === '_connected') {
        setIsConnected(message.isConnected);
        return;
      }

      
      if (onMessage) {
        onMessage(message);
      }
    });

    
    return () => {
            wsManager.unsubscribe(listenerId);
    };
  }, [token]); 

  const sendMessage = (message) => {
    wsManager.send(message);
  };

  return { isConnected, sendMessage };
};

export default useSharedWebSocket;
