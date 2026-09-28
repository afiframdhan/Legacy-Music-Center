const DEFAULT_ICON = '/icons/icon-192.png';
const DEFAULT_BADGE = '/icons/icon-192.png';

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch (_) {
    payload = { title:'Legacy Music Center', body:event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'Legacy Music Center';
  const options = {
    body: payload.body || 'Ada informasi baru untuk Anda.',
    icon: payload.icon || DEFAULT_ICON,
    badge: payload.badge || DEFAULT_BADGE,
    tag: payload.tag || 'legacy-notification',
    renotify: Boolean(payload.renotify),
    data: {
      url: payload.url || '/',
      ...(payload.data || {})
    }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type:'window', includeUncontrolled:true });
    for (const client of windows) {
      if ('focus' in client) {
        try {
          await client.navigate(target);
          return client.focus();
        } catch (_) {
          return client.focus();
        }
      }
    }
    return clients.openWindow ? clients.openWindow(target) : null;
  })());
});
