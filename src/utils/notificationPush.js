import { API_URL } from '../config';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` });
export async function enableBrowserPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('This browser does not support push notifications.');
  const response = await fetch(`${API_URL}/notification_push/config`, { headers: headers() });
  if (!response.ok) throw new Error('Could not check push availability. Please retry.');
  const config = await response.json();
  if (!config.web_enabled) throw new Error('Browser push is not available yet. In-app notifications still work.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Allow notifications in your browser settings to enable push.');
  await navigator.serviceWorker.register('/notification-worker.js');
  const registration = await navigator.serviceWorker.ready;
  const raw = atob(config.public_key.replace(/-/g, '+').replace(/_/g, '/'));
  const applicationServerKey = Uint8Array.from(raw, char => char.charCodeAt(0));
  const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
  const saved = await fetch(`${API_URL}/notification_push/subscriptions`, { method: 'POST', headers: headers(), body: JSON.stringify({ platform: 'web', subscription: subscription.toJSON() }) });
  if (!saved.ok) { await subscription.unsubscribe(); throw new Error('Could not save push preferences. Please retry.'); }
  const data = await saved.json();
  localStorage.setItem('cerbyl.pushSubscription', String(data.id));
}
export async function disableBrowserPush() {
  const id = localStorage.getItem('cerbyl.pushSubscription');
  const authHeaders = headers();
  localStorage.removeItem('cerbyl.pushSubscription');
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration('/notification-worker.js');
    await (await registration?.pushManager.getSubscription())?.unsubscribe();
    const visible = await registration?.getNotifications();
    visible?.forEach(notification => notification.close());
  }
  if (id) {
    const response = await fetch(`${API_URL}/notification_push/subscriptions/${id}`, { method: 'DELETE', headers: authHeaders, keepalive: true });
    if (!response.ok) throw new Error('Push was disabled on this browser, but the server could not be updated. Please retry.');
  }
}
