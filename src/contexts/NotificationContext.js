import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
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
      } catch (e) { /* silenced */ }
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

const formatNotificationMessage = (message = '') => (
  String(message)
    .replace(/\s*\[reminder_id:\d+\]\s*/g, ' ')
    .replace(/\s*\[reminder_due_at:[^\]]+\]\s*/g, ' ')
    .replace(/\s*\[login_return:\d{4}-\d{2}-\d{2}\]\s*/g, ' ')
    .replace(/\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)\b/g, (match) => {
      const parsed = new Date(match);
      if (Number.isNaN(parsed.getTime())) return match;
      return parsed.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    })
    .replace(/\s{2,}/g, ' ')
    .trim()
);

const extractReminderDueAt = (message = '') => {
  const match = String(message).match(/\[reminder_due_at:([^\]]+)\]/);
  if (!match) return null;
  const parsed = new Date(match[1]);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const getNotificationQueueKey = (notification = {}) => (
  `${notification.id || 'unknown'}:${notification.created_at || ''}`
);

const getDueSlideTitle = (title = '') => {
  const baseTitle = String(title)
    .replace(/\s+-\s+In\s+\d+\s+min!?/gi, '')
    .replace(/\s+-\s+NOW!?/gi, '')
    .trim();
  return `${baseTitle || 'Reminder'} - NOW!`;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [slideQueue, setSlideQueue] = useState([]);

  const pollRef = useRef(null);
  const lastCheckRef = useRef(0);
  const nextAllowedPollAtRef = useRef(0);
  const seenNotificationIdsRef = useRef(new Set());
  const queuedSlideIdsRef = useRef(new Set());
  const dueSlideTimeoutsRef = useRef(new Map());
  const queuedDueSlideKeysRef = useRef(new Set());
  const hasLoadedNotificationsRef = useRef(false);
  const providerStartedAtRef = useRef(Date.now());

  const pollNotifications = useCallback(async (force = false) => {
    try {
      const { token, userName } = getAuthFromStorage();
      if (!token || !userName) {
        setNotifications([]);
        setUnreadCount(0);
        setSlideQueue([]);
        seenNotificationIdsRef.current = new Set();
        queuedSlideIdsRef.current = new Set();
        dueSlideTimeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
        dueSlideTimeoutsRef.current.clear();
        queuedDueSlideKeysRef.current = new Set();
        hasLoadedNotificationsRef.current = false;
        return;
      }
      if (!getNotificationsEnabled()) {
        setNotifications([]);
        setUnreadCount(0);
        setSlideQueue([]);
        seenNotificationIdsRef.current = new Set();
        queuedSlideIdsRef.current = new Set();
        dueSlideTimeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
        dueSlideTimeoutsRef.current.clear();
        queuedDueSlideKeysRef.current = new Set();
        hasLoadedNotificationsRef.current = false;
        return;
      }

      const now = Date.now();
      if (!force && now < nextAllowedPollAtRef.current) {
        return;
      }
      if (!force && now - lastCheckRef.current < 5000) {
        return;
      }
      lastCheckRef.current = now;

      const timezoneOffset = new Date().getTimezoneOffset();
      const response = await fetch(`${API_URL}/get_notifications?user_id=${encodeURIComponent(userName)}&timezone_offset=${timezoneOffset}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('Retry-After'));
        const retryDelayMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 60000;
        nextAllowedPollAtRef.current = Date.now() + retryDelayMs;
        return;
      }

      if (!response.ok) {
        return;
      }

      nextAllowedPollAtRef.current = 0;

      const data = await response.json();
      const notifs = (data.notifications || []).map(notif => ({
        ...notif,
        reminder_due_at: extractReminderDueAt(notif.message),
        message: formatNotificationMessage(notif.message)
      }));

      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.is_read).length);

      const firstLoad = !hasLoadedNotificationsRef.current;
      const recentFirstLoadCutoff = providerStartedAtRef.current - 120000;
      const newNotifs = notifs.filter(notif => {
        const queueKey = getNotificationQueueKey(notif);
        if (notif.is_read || queuedSlideIdsRef.current.has(queueKey)) return false;

        const createdAt = Date.parse(notif.created_at || '');
        const isRecentFirstLoadNotif = firstLoad && Number.isFinite(createdAt) && createdAt >= recentFirstLoadCutoff;
        const isNewlySeenNotif = !firstLoad && !seenNotificationIdsRef.current.has(queueKey);

        return isRecentFirstLoadNotif || isNewlySeenNotif;
      });

      if (newNotifs.length > 0) {
        const newSlideNotifs = newNotifs.map(notif => ({
          id: notif.id,
          title: notif.title,
          message: notif.message,
          notification_type: notif.notification_type || 'general',
          created_at: notif.created_at,
          reminder_due_at: notif.reminder_due_at
        }));

        setSlideQueue(prev => [...prev, ...newSlideNotifs]);

        newNotifs.forEach(n => queuedSlideIdsRef.current.add(getNotificationQueueKey(n)));
      }

      seenNotificationIdsRef.current = new Set(notifs.map(getNotificationQueueKey));
      hasLoadedNotificationsRef.current = true;

      notifs.forEach(notif => {
        if (!notif.reminder_due_at || notif.is_read) return;
        if (!['reminder', 'calendar_event'].includes(notif.notification_type || '')) return;

        const queueKey = `due:${getNotificationQueueKey(notif)}`;
        if (queuedDueSlideKeysRef.current.has(queueKey) || dueSlideTimeoutsRef.current.has(queueKey)) return;

        const dueTime = Date.parse(notif.reminder_due_at);
        if (!Number.isFinite(dueTime)) return;

        const delay = dueTime - Date.now();
        if (delay < -120000 || delay > 24 * 60 * 60 * 1000) return;

        const showDueSlide = () => {
          dueSlideTimeoutsRef.current.delete(queueKey);
          if (queuedDueSlideKeysRef.current.has(queueKey)) return;
          queuedDueSlideKeysRef.current.add(queueKey);
          setSlideQueue(prev => [...prev, {
            id: notif.id,
            title: getDueSlideTitle(notif.title),
            message: notif.message,
            notification_type: notif.notification_type || 'reminder',
            created_at: new Date().toISOString(),
            reminder_due_at: notif.reminder_due_at
          }]);
        };

        if (delay <= 0) {
          showDueSlide();
          return;
        }

        dueSlideTimeoutsRef.current.set(queueKey, setTimeout(showDueSlide, delay));
      });
    } catch (error) { /* silenced */ }
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
    }
    pollNotifications(true);
    pollRef.current = setInterval(() => pollNotifications(false), 10000);
  }, [pollNotifications]);

  useEffect(() => {
    startPolling();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      dueSlideTimeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
      dueSlideTimeoutsRef.current.clear();
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
        queuedSlideIdsRef.current.add(notifId);
      }
    } catch (error) { /* silenced */ }
  }, []);

  const markAllNotificationsAsRead = useCallback(async () => {
    try {
      const { token, userName } = getAuthFromStorage();
      if (!token || !userName) return;

      const response = await fetch(`${API_URL}/mark_all_notifications_read?user_id=${encodeURIComponent(userName)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
        setSlideQueue([]);
      }
    } catch (error) { /* silenced */ }
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
        seenNotificationIdsRef.current.add(notifId);
        queuedSlideIdsRef.current.add(notifId);
        setSlideQueue(prev => prev.filter(n => n.id !== notifId));
      }
    } catch (error) { /* silenced */ }
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
        markAllNotificationsAsRead,
        deleteNotification
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
