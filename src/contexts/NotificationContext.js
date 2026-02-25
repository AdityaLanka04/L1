import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { API_URL } from '../config';

const NotificationContext = createContext(null);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

const getAuthFromStorage = () => {
  const token = localStorage.getItem('token');
  let userName = localStorage.getItem('username');

  if (!userName) {
    const rawProfile = localStorage.getItem('userProfile');
    if (rawProfile) {
      try {
        const parsed = JSON.parse(rawProfile);
        userName = parsed.username || parsed.email || '';
      } catch (e) {}
    }
  }

  return { token, userName };
};

const getNotificationsEnabled = () => {
  const raw = localStorage.getItem('userProfile');
  if (!raw) return true;
  try {
    const parsed = JSON.parse(raw);
    return parsed.notificationsEnabled !== false;
  } catch (e) {
    return true;
  }
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [slideQueue, setSlideQueue] = useState([]);

  const pollRef = useRef(null);
  const lastCheckRef = useRef(0);
  const lastNotificationIdsRef = useRef(new Set());

  const pollNotifications = useCallback(async (force = false) => {
    try {
      const { token, userName } = getAuthFromStorage();
      if (!token || !userName) {
        setNotifications([]);
        setUnreadCount(0);
        setSlideQueue([]);
        lastNotificationIdsRef.current = new Set();
        return;
      }
      if (!getNotificationsEnabled()) {
        setNotifications([]);
        setUnreadCount(0);
        setSlideQueue([]);
        lastNotificationIdsRef.current = new Set();
        return;
      }

      const now = Date.now();
      if (!force && now - lastCheckRef.current < 5000) {
        return;
      }
      lastCheckRef.current = now;

      const response = await fetch(`${API_URL}/get_notifications?user_id=${encodeURIComponent(userName)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      const notifs = data.notifications || [];

      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.is_read).length);

      const newNotifs = notifs.filter(notif =>
        !lastNotificationIdsRef.current.has(notif.id) && !notif.is_read
      );

      if (newNotifs.length > 0) {
        const newSlideNotifs = newNotifs.map(notif => ({
          id: notif.id,
          title: notif.title,
          message: notif.message,
          notification_type: notif.notification_type || 'general',
          created_at: notif.created_at
        }));

        setSlideQueue(prev => [...prev, ...newSlideNotifs]);

        newNotifs.forEach(n => lastNotificationIdsRef.current.add(n.id));
      }
    } catch (error) {
      
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
    }
    pollNotifications(true);
    pollRef.current = setInterval(() => pollNotifications(false), 30000);
  }, [pollNotifications]);

  useEffect(() => {
    startPolling();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [startPolling]);

  useEffect(() => {
    const handleSettingsChange = () => {
      pollNotifications(true);
    };

    window.addEventListener('notification-settings-changed', handleSettingsChange);
    return () => {
      window.removeEventListener('notification-settings-changed', handleSettingsChange);
    };
  }, [pollNotifications]);

  const refreshNotifications = useCallback(() => {
    pollNotifications(true);
  }, [pollNotifications]);

  const removeSlideNotification = useCallback((notifId) => {
    setSlideQueue(prev => prev.filter(n => n.id !== notifId));
  }, []);

  const markNotificationAsRead = useCallback(async (notifId) => {
    try {
      const { token } = getAuthFromStorage();
      if (!token) return;

      const response = await fetch(`${API_URL}/mark_notification_read/${notifId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setNotifications(prev => prev.map(n =>
          n.id === notifId ? { ...n, is_read: true } : n
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));
        setSlideQueue(prev => prev.filter(n => n.id !== notifId));
      }
    } catch (error) {
      
    }
  }, []);

  const deleteNotification = useCallback(async (notifId) => {
    try {
      const { token } = getAuthFromStorage();
      if (!token) return;

      const response = await fetch(`${API_URL}/delete_notification/${notifId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setNotifications(prev => {
          const target = prev.find(n => n.id === notifId);
          const wasUnread = target ? !target.is_read : false;
          if (wasUnread) {
            setUnreadCount(count => Math.max(0, count - 1));
          }
          return prev.filter(n => n.id !== notifId);
        });
        lastNotificationIdsRef.current.add(notifId);
        setSlideQueue(prev => prev.filter(n => n.id !== notifId));
      }
    } catch (error) {
      
    }
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        slideQueue,
        refreshNotifications,
        removeSlideNotification,
        markNotificationAsRead,
        deleteNotification
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
