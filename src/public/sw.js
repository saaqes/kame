const CACHE = 'kame-v1';
const STATIC = [
  '/',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // No cachear las rutas de API ni solicitudes POST
  if (url.pathname.startsWith('/api') || e.request.method !== 'GET') {
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cachear solo respuestas exitosas de páginas
        if (res.ok && (url.pathname === '/' || url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('/')))
  );
});

// Notificaciones push
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'Empanadas Kame 🔥', body: '¡Nueva notificación!' };
  e.waitUntil(
    self.registration.showNotification(data.title || 'Empanadas Kame 🔥', {
      body: data.body || '',
      icon: data.icon || 'https://www.nicepng.com/png/full/201-2014028_esfera-del-dragon-de-4-estrella-render-hd.png',
      badge: data.icon || 'https://www.nicepng.com/png/full/201-2014028_esfera-del-dragon-de-4-estrella-render-hd.png',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const url = e.notification.data?.url || '/';
      const match = list.find(c => c.url === url && 'focus' in c);
      return match ? match.focus() : clients.openWindow(url);
    })
  );
});
