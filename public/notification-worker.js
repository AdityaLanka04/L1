/* Standalone worker: no caching or interception of application requests. */
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { /* display generic update */ }
  event.waitUntil(self.registration.showNotification('Cerbyl notification', {
    body: 'You have a new update. Open Cerbyl to read it.', icon: '/favicon.ico',
    tag: data.tag || 'cerbyl-update', data: { url: '/dashboard-cerbyl' }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    const client = clients.find(item => new URL(item.url).origin === self.location.origin);
    return client ? client.focus() : self.clients.openWindow('/dashboard-cerbyl');
  }));
});
