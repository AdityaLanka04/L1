

class WebSocketManager {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = null;
    this.messageQueue = [];
    this.token = null;
  }

  connect(token) {
    
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
                return;
      } else if (this.ws.readyState === WebSocket.CONNECTING) {
                return;
      }
    }

    if (!token) {
            return;
    }

    this.token = token;

    
    let wsUrl;
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    
    if (API_URL.includes('localhost')) {
      wsUrl = API_URL.replace('http://', 'ws://').replace('https://', 'ws://');
    } else {
      wsUrl = API_URL.replace('http://', 'wss://').replace('https://', 'wss://');
    }
    
    wsUrl = wsUrl.replace('/api', '');
    const wsEndpoint = `${wsUrl}/ws?token=${encodeURIComponent(token)}`;
    
    try {
      this.ws = new WebSocket(wsEndpoint);

      this.ws.onopen = () => {
                this.isConnected = true;
        this.reconnectAttempts = 0;
        
        
        this.notifyListeners({ type: '_connected', isConnected: true });

        
        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift();
          this.ws.send(JSON.stringify(msg));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
                    
          
          this.notifyListeners(data);
        } catch (error) {
    // silenced
  }
      };

      this.ws.onerror = (error) => {
                this.isConnected = false;
        this.notifyListeners({ type: '_connected', isConnected: false });
      };

      this.ws.onclose = (event) => {
                this.isConnected = false;
        this.notifyListeners({ type: '_connected', isConnected: false });

        
        if (event.code === 1008) {
                    return;
        }

        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
                    
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect(this.token);
          }, delay);
        }
      };
    } catch (error) {
    // silenced
  }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close(1000, 'Manual disconnect');
    }
    
    this.ws = null;
    this.isConnected = false;
  }

  subscribe(id, callback) {
        this.listeners.set(id, callback);
    
    
    callback({ type: '_connected', isConnected: this.isConnected });
  }

  unsubscribe(id) {
        this.listeners.delete(id);
    
    
    if (this.listeners.size === 0) {
            this.disconnect();
    }
  }

  notifyListeners(message) {
    this.listeners.forEach((callback, id) => {
      try {
        callback(message);
      } catch (error) {
    // silenced
  }
    });
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
            this.messageQueue.push(message);
    }
  }
}

const wsManager = new WebSocketManager();

export default wsManager;
