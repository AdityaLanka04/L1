// src/utils/trialManager.js

class TrialManager {
  constructor() {
    this.TRIAL_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
    this.STORAGE_KEY = 'brainwave_trial';
    this.FINGERPRINT_KEY = 'brainwave_fp';
    this.WARNING_TIME = 60 * 1000; // Show warning at 1 minute remaining
  }

  // Generate privacy-safe browser fingerprint
  generateFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('BrainwaveFingerprint', 2, 2);
    
    const fingerprint = {
      screen: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform.substring(0, 20),
      userAgent: navigator.userAgent.substring(0, 50),
      canvas: canvas.toDataURL().substring(0, 50),
      memory: navigator.deviceMemory || 'unknown',
      cores: navigator.hardwareConcurrency || 'unknown',
      colorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio
    };
    
    // Simple hash function
    const hashCode = (str) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(36);
    };
    
    return hashCode(JSON.stringify(fingerprint));
  }

  // Initialize trial tracking
  async initializeTrial() {
    const fingerprint = this.generateFingerprint();
    const now = Date.now();
    
    // Check IndexedDB for more persistent storage
    const indexedDBTrial = await this.checkIndexedDBTrial(fingerprint);
    if (indexedDBTrial && indexedDBTrial.blocked) {
      return { expired: true, timeUsed: this.TRIAL_DURATION, reason: 'previous_session' };
    }
    
    // Check local storage
    const localTrial = localStorage.getItem(this.STORAGE_KEY);
    const storedFingerprint = localStorage.getItem(this.FINGERPRINT_KEY);
    
    if (localTrial && storedFingerprint === fingerprint) {
      const trialData = JSON.parse(localTrial);
      if (this.isTrialExpired(trialData.startTime)) {
        await this.storeTrialInIndexedDB(fingerprint, trialData.startTime);
        return { expired: true, timeUsed: this.TRIAL_DURATION, reason: 'time_expired' };
      }
      return { 
        expired: false, 
        timeUsed: now - trialData.startTime,
        timeRemaining: this.TRIAL_DURATION - (now - trialData.startTime)
      };
    }
    
    // Check with server
    try {
      const serverCheck = await this.checkServerTrial(fingerprint);
      if (serverCheck.blocked) {
        return { expired: true, timeUsed: this.TRIAL_DURATION, reason: 'server_blocked' };
      }
    } catch (error) {
      console.warn('Server trial check failed:', error);
    }
    
    // Start new trial
    const trialData = {
      startTime: now,
      fingerprint: fingerprint,
      sessionId: this.generateSessionId()
    };
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trialData));
    localStorage.setItem(this.FINGERPRINT_KEY, fingerprint);
    sessionStorage.setItem('trial_active', 'true');
    
    // Notify server
    try {
      await this.notifyServerTrialStart(fingerprint);
    } catch (error) {
      console.warn('Server notification failed:', error);
    }
    
    return { 
      expired: false, 
      timeUsed: 0,
      timeRemaining: this.TRIAL_DURATION
    };
  }

  // IndexedDB operations for persistent storage
  async checkIndexedDBTrial(fingerprint) {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('BrainwaveTrials', 1);
        
        request.onerror = () => resolve(null);
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('trials')) {
            db.createObjectStore('trials', { keyPath: 'fingerprint' });
          }
        };
        
        request.onsuccess = (event) => {
          const db = event.target.result;
          const transaction = db.transaction(['trials'], 'readonly');
          const store = transaction.objectStore('trials');
          const getRequest = store.get(fingerprint);
          
          getRequest.onsuccess = () => {
            const result = getRequest.result;
            if (result && (Date.now() - result.timestamp) < 24 * 60 * 60 * 1000) {
              resolve({ blocked: true });
            } else {
              resolve(null);
            }
          };
          
          getRequest.onerror = () => resolve(null);
        };
      } catch (error) {
        resolve(null);
      }
    });
  }

  async storeTrialInIndexedDB(fingerprint, startTime) {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('BrainwaveTrials', 1);
        
        request.onsuccess = (event) => {
          const db = event.target.result;
          const transaction = db.transaction(['trials'], 'readwrite');
          const store = transaction.objectStore('trials');
          
          store.put({
            fingerprint: fingerprint,
            timestamp: startTime,
            expired: true
          });
          
          resolve();
        };
        
        request.onerror = () => resolve();
      } catch (error) {
        resolve();
      }
    });
  }

  // Check if trial is expired
  isTrialExpired(startTime) {
    return (Date.now() - startTime) >= this.TRIAL_DURATION;
  }

  // Get current trial status
  getCurrentStatus() {
    const localTrial = localStorage.getItem(this.STORAGE_KEY);
    if (!localTrial) {
      return { active: false, timeRemaining: this.TRIAL_DURATION };
    }
    
    const trialData = JSON.parse(localTrial);
    const timeUsed = Date.now() - trialData.startTime;
    const timeRemaining = Math.max(0, this.TRIAL_DURATION - timeUsed);
    
    return {
      active: true,
      expired: timeRemaining === 0,
      timeUsed: timeUsed,
      timeRemaining: timeRemaining,
      startTime: trialData.startTime,
      showWarning: timeRemaining <= this.WARNING_TIME && timeRemaining > 0
    };
  }

  // Server communication methods
  async checkServerTrial(fingerprint) {
    try {
      const response = await fetch('http://localhost:8001/check_trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint })
      });
      return await response.json();
    } catch (error) {
      return { blocked: false }; // Fail open for better UX
    }
  }

  async notifyServerTrialStart(fingerprint) {
    try {
      await fetch('http://localhost:8001/start_trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fingerprint,
          timestamp: Date.now(),
          userAgent: navigator.userAgent.substring(0, 100),
          ip: 'client_side' // Server will capture real IP
        })
      });
    } catch (error) {
      console.warn('Failed to notify server of trial start:', error);
    }
  }

  // Utility methods
  generateSessionId() {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  // Format time remaining for display
  formatTimeRemaining(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${seconds}s`;
    }
  }

  // Clear trial data (for testing)
  clearTrial() {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.FINGERPRINT_KEY);
    sessionStorage.removeItem('trial_active');
  }

  // Check if user is logged in
  isUserLoggedIn() {
    return !!localStorage.getItem('token');
  }

  // Get IP address (fallback method)
  async getClientIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      return 'unknown';
    }
  }
}

export default new TrialManager();