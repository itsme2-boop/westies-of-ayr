/* Westies of Ayr offline support. Registered from index.html as sw.js?v=APP_VERSION,
   so each app version gets its own cache and old caches are deleted on activate.
   Pages (navigations) are network-first, so a phone always gets the newest index.html when online and
   then registers the new sw.js?v=; offline it falls back to the cached page. (v1.10 fix: cache-first pages
   kept phones on the old index.html, which kept re-registering the old, unchanged service worker.)
   Everything else is cache-first: the app shell, scripts, 3D model and thumbnails are stored on install (index.html only loads
   three.js, the model and game.js when a statue, the painter or the Game tab opens; they are cached here for offline use);
   full photos, fonts and anything else same-origin/CDN are stored the first time they load.
   Map tiles (server.arcgisonline.com, Esri) are NOT cached: Esri's terms on offline tile storage
   have not been checked, so the map background needs a connection. */
const CACHE = 'westies-v' + (new URL(location).searchParams.get('v') || '0'); // v1.10: pages network-first (bug 12); v1.9: same file list, game.js now holds level 11 (Wee Clank's Leap)
const nn = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'locations.js', 'statue.js', 'game.js',
  'model/westie-model.js', 'photos/photos.js', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  ...nn.map(n => `photos/thumbs/${n}.jpg`), ...nn.map(n => `thumbs/${n}.webp`), // street photos + pre-rendered statues
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'
];
const NO_CACHE = /(^|\.)arcgisonline\.com$/; // Esri tiles: network only, see note above

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('westies-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || NO_CACHE.test(url.hostname) || !url.protocol.startsWith('http')) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res.ok) c.put('index.html', res.clone()).catch(() => {});
        return res;
      } catch (err) { /* offline: use the cached page below */ }
    }
    // index.html?cert=1 / #s5 / ./ all share the one cached page
    const hit = await c.match(req, { ignoreSearch: req.mode === 'navigate' }) || (req.mode === 'navigate' && await c.match('index.html'));
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') c.put(req, res.clone()).catch(() => {}); // quota full: still serve it
    return res;
  })());
});
