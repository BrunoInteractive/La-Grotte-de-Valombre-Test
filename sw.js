/* La Grotte de Valombre — Service Worker
   IMPORTANT : augmenter APP_VERSION à chaque nouvelle mise en ligne. */
const APP_VERSION = '68.119';
const CACHE_PREFIX = 'valombre-joueurs-';
const CACHE_NAME = `${CACHE_PREFIX}${APP_VERSION}`;

self.addEventListener('install', () => {
  // La nouvelle version n'attend pas la fermeture de l'ancienne.
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Supprime uniquement les anciens caches de Valombre.
    const names = await caches.keys();
    await Promise.all(
      names
        .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
        .map(name => caches.delete(name))
    );

    await self.clients.claim();

    // Recharge les fenêtres Valombre déjà ouvertes afin qu'elles prennent
    // immédiatement les nouveaux fichiers. La sauvegarde localStorage reste intacte.
    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    await Promise.all(windows.map(client => {
      try { return client.navigate(client.url); }
      catch (_) { return Promise.resolve(); }
    }));
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Ne gère que les fichiers hébergés sur le même GitHub Pages.
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      // Réseau d'abord : évite qu'une ancienne page ou un ancien JS reste bloqué.
      const response = await fetch(request, { cache: 'no-store' });

      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone()).catch(() => {});
      }

      return response;
    } catch (error) {
      // Hors ligne : utilise la dernière copie disponible.
      const cached = await caches.match(request);
      if (cached) return cached;

      if (request.mode === 'navigate') {
        const fallback =
          await caches.match('./index.html') ||
          await caches.match('./');
        if (fallback) return fallback;
      }

      throw error;
    }
  })());
});
