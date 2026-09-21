import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { API_URL } from '../config';
import { cleanNotificationMessage, notificationsEnabled } from '../utils/notificationPresentation';

const NotificationContext = createContext(null);
export const useNotifications = () => {
  const value = useContext(NotificationContext);
  if (!value) throw new Error('useNotifications must be used within NotificationProvider');
  return value;
};
const auth = () => ({ token: localStorage.getItem('token') || '', user: localStorage.getItem('username') || '' });
const identity = ({ token, user }) => `${user}:${token}`;
const keyFor = n => `${n.id}:${n.created_at}`;
const empty = { notifications: [], unreadCount: 0, totalCount: 0, nextCursor: null, loading: true, error: '', slideQueue: [], selectedNotification: null };

export const NotificationProvider = ({ children }) => {
  const [state, setState] = useState(empty);
  const location = useLocation();
  const scope = useRef('');
  const generation = useRef(0);
  const request = useRef(null);
  const backoff = useRef(0);
  const pending = useRef(new Map());
  const stateRef = useRef(state); stateRef.current = state;
  const presented = useRef(new Map());
  const firstLoad = useRef(true);
  const accountStarted = useRef(Date.now());
  const enabled = useRef(notificationsEnabled());
  const preferenceChangedAt = useRef(0);
  const timers = useRef(new Map());
  const mounted = useRef(true);
  const storageKey = useRef('');

  const remember = useCallback(key => {
    presented.current.set(key, Date.now());
    const cutoff = Date.now() - 86400000;
    presented.current = new Map([...presented.current].filter(([, t]) => t >= cutoff).slice(-500));
    try { sessionStorage.setItem(storageKey.current, JSON.stringify([...presented.current])); } catch { /* in-memory fallback */ }
  }, []);
  const stopTimers = useCallback(() => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);
  const syncScope = useCallback(() => {
    const current = identity(auth());
    const changed = current !== scope.current;
    const setting = notificationsEnabled();
    if (changed) {
      generation.current += 1;
      request.current?.controller.abort(); request.current = null;
      stopTimers(); pending.current.clear(); backoff.current = 0;
      scope.current = current;
      storageKey.current = `cerbyl.notification.presented:${auth().user}`;
      try { presented.current = new Map(JSON.parse(sessionStorage.getItem(storageKey.current) || '[]')); } catch { presented.current = new Map(); }
      firstLoad.current = true; accountStarted.current = Date.now();
      setState({ ...empty, loading: Boolean(auth().token) });
    }
    if (enabled.current !== setting) {
      generation.current += 1;
      request.current?.controller.abort(); request.current = null;
      stopTimers(); enabled.current = setting; preferenceChangedAt.current = Date.now();
      setState(prev => ({ ...prev, slideQueue: [] }));
    }
    return changed;
  }, [stopTimers]);

  const fetchPage = useCallback(async (append = false) => {
    syncScope();
    const credentials = auth(), session = identity(credentials);
    if (!credentials.token || !credentials.user) return false;
    if (Date.now() < backoff.current || pending.current.size) return false;
    if (request.current) return request.current.promise;
    const version = generation.current;
    const cursor = append ? stateRef.current.nextCursor : null;
    if (append && !cursor) return true;
    const controller = new AbortController();
    const live = () => mounted.current && version === generation.current && session === identity(auth());
    const run = async () => {
      setState(prev => ({ ...prev, loading: true, error: '' }));
      try {
        const count = append ? 25 : Math.max(25, stateRef.current.notifications.length);
        const response = await fetch(`${API_URL}/get_notifications?user_id=${encodeURIComponent(credentials.user)}&timezone_offset=${new Date().getTimezoneOffset()}&limit=${Math.min(200, count)}${cursor ? `&before_id=${cursor}` : ''}`, { headers: { Authorization: `Bearer ${credentials.token}` }, signal: controller.signal });
        if (!live()) return false;
        if (response.status === 429) {
          const value = response.headers.get('Retry-After');
          const seconds = Number(value);
          backoff.current = Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : Math.max(60000, Date.parse(value) - Date.now() || 0));
        }
        if (!response.ok) throw new Error(response.status === 429 ? 'Notifications are temporarily busy. Please retry shortly.' : 'Could not load notifications. Please retry.');
        const data = await response.json();
        if (!live()) return false;
        // Refresh all loaded history, not just the API's maximum first page.
        while (!append && data.next_cursor && data.notifications.length < count) {
          const next = await fetch(`${API_URL}/get_notifications?user_id=${encodeURIComponent(credentials.user)}&limit=${Math.min(200, count - data.notifications.length)}&before_id=${data.next_cursor}`, { headers: { Authorization: `Bearer ${credentials.token}` }, signal: controller.signal });
          if (!live()) return false;
          if (next.status === 429) backoff.current = Date.now() + Math.max(60000, Number(next.headers.get('Retry-After')) * 1000 || 0);
          if (!next.ok) throw new Error('Could not refresh older notifications. Please retry.');
          const page = await next.json();
          data.notifications.push(...page.notifications);
          data.next_cursor = page.next_cursor;
        }
        if (typeof data.notifications_enabled === 'boolean' && Date.now() - preferenceChangedAt.current > 5000) {
          enabled.current = data.notifications_enabled;
          try {
            const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
            localStorage.setItem('userProfile', JSON.stringify({ ...profile, notificationsEnabled: enabled.current }));
          } catch { /* keep current in-memory preference */ }
        }
        const rows = (data.notifications || []).map(n => ({ ...n, message: cleanNotificationMessage(n.message) }));
        const slides = [];
        if (!append && enabled.current) for (const n of rows) {
          const key = keyFor(n);
          if (n.is_read || presented.current.has(key) || (firstLoad.current && Date.parse(n.created_at) < accountStarted.current - 120000)) continue;
          // The due timer owns an immediately due alert, avoiding duplicate popups.
          const due = Date.parse(n.reminder_due_at);
          if (!(due <= Date.now() && due >= Date.now() - 120000)) slides.push({ ...n, queueKey: key });
          remember(key);
        }
        firstLoad.current = false;
        setState(prev => {
          const notifications = append ? [...prev.notifications, ...rows.filter(n => !prev.notifications.some(old => old.id === n.id))] : rows;
          const active = new Set(notifications.filter(n => !n.is_read).map(n => n.id));
          return { ...prev, notifications, unreadCount: data.unread_count ?? rows.filter(n => !n.is_read).length,
            totalCount: data.total_count ?? rows.length, nextCursor: data.next_cursor ?? null,
            slideQueue: enabled.current ? [...prev.slideQueue.filter(n => active.has(n.id)), ...slides] : [], loading: false, error: '' };
        });
        return true;
      } catch (error) {
        if (live() && error.name !== 'AbortError') setState(prev => ({ ...prev, loading: false, error: error.message }));
        return false;
      } finally {
        if (request.current?.controller === controller) request.current = null;
      }
    };
    const promise = run(); request.current = { controller, promise };
    return promise;
  }, [remember, syncScope]);

  useEffect(() => {
    mounted.current = true;
    const refresh = () => { syncScope(); void fetchPage(); };
    refresh();
    const interval = setInterval(refresh, 30000);
    window.addEventListener('storage', refresh);
    window.addEventListener('auth-session-changed', refresh);
    window.addEventListener('notification-settings-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      mounted.current = false; generation.current += 1; request.current?.controller.abort(); request.current = null;
      clearInterval(interval); stopTimers();
      window.removeEventListener('storage', refresh);
      window.removeEventListener('auth-session-changed', refresh);
      window.removeEventListener('notification-settings-changed', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [fetchPage, stopTimers, syncScope]);
  useEffect(() => { if (syncScope()) void fetchPage(); }, [location.key, fetchPage, syncScope]);

  useEffect(() => {
    stopTimers();
    if (!enabled.current || !auth().token) return;
    const session = scope.current;
    for (const n of state.notifications) {
      const due = Date.parse(n.reminder_due_at), key = `due:${keyFor(n)}`;
      if (n.is_read || !Number.isFinite(due) || due < Date.now() - 120000 || due > Date.now() + 86400000 || presented.current.has(key)) continue;
      const show = () => {
        if (session !== identity(auth()) || !notificationsEnabled()) return;
        if (!stateRef.current.notifications.some(item => item.id === n.id && !item.is_read)) return;
        remember(key);
        setState(prev => ({ ...prev, slideQueue: [...prev.slideQueue.filter(item => item.id !== n.id), { ...n, dueNow: true, queueKey: key, title: `${n.title.replace(/ - (NOW!|In \d+ min!)/g, '')} — Due now` }] }));
      };
      timers.current.set(key, setTimeout(show, Math.max(0, due - Date.now())));
    }
    return stopTimers;
  }, [state.notifications, remember, stopTimers]);

  const mutate = useCallback(async (operation, id) => {
    syncScope();
    const credentials = auth(), session = identity(credentials);
    if (!credentials.token) return false;
    const operationKey = `${operation}:${id ?? 'all'}`;
    if (pending.current.has(operationKey)) return pending.current.get(operationKey);
    // Retire any read snapshot captured before this write.
    generation.current += 1; request.current?.controller.abort(); request.current = null;
    stopTimers();
    const task = (async () => {
      try {
        const path = operation === 'all' ? `mark_all_notifications_read?user_id=${encodeURIComponent(credentials.user)}` : operation === 'delete' ? `delete_notification/${id}` : `mark_notification_read/${id}`;
        const response = await fetch(`${API_URL}/${path}`, { method: operation === 'delete' ? 'DELETE' : 'PUT', headers: { Authorization: `Bearer ${credentials.token}` } });
        if (session !== identity(auth()) || !mounted.current) return false;
        if (!response.ok) throw new Error('Could not update this notification. Please retry.');
        setState(prev => {
          const item = prev.notifications.find(n => n.id === id);
          const notifications = operation === 'delete' ? prev.notifications.filter(n => n.id !== id) : prev.notifications.map(n => operation === 'all' || n.id === id ? { ...n, is_read: true } : n);
          return { ...prev, notifications, loading: false, error: '',
            unreadCount: operation === 'all' ? 0 : Math.max(0, prev.unreadCount - (item && !item.is_read ? 1 : 0)),
            totalCount: operation === 'delete' ? Math.max(0, prev.totalCount - (item ? 1 : 0)) : prev.totalCount,
            slideQueue: operation === 'all' ? [] : prev.slideQueue.filter(n => n.id !== id) };
        });
        return true;
      } catch (error) {
        if (session === identity(auth()) && mounted.current) setState(prev => ({ ...prev, loading: false, error: error.message, notifications: [...prev.notifications] }));
        return false;
      } finally { pending.current.delete(operationKey); }
    })();
    pending.current.set(operationKey, task);
    return task;
  }, [stopTimers, syncScope]);

  const removeSlideNotification = useCallback(queueKey => setState(prev => ({ ...prev, slideQueue: prev.slideQueue.filter(n => n.queueKey !== queueKey) })), []);
  const openNotification = useCallback(n => { setState(prev => ({ ...prev, selectedNotification: n })); void mutate('read', n.id); }, [mutate]);
  const closeNotification = useCallback(() => setState(prev => ({ ...prev, selectedNotification: null })), []);
  return <NotificationContext.Provider value={{ ...state,
    refreshNotifications: (invalidate = false) => {
      if (invalidate === true) { generation.current += 1; request.current?.controller.abort(); request.current = null; stopTimers(); }
      return fetchPage();
    }, loadMoreNotifications: () => fetchPage(true),
    markNotificationAsRead: id => mutate('read', id), markAllNotificationsAsRead: () => mutate('all'), deleteNotification: id => mutate('delete', id),
    removeSlideNotification, openNotification, closeNotification }} >{children}</NotificationContext.Provider>;
};
