/* Westies of Ayr offline support. Registered from index.html as sw.js?v=APP_VERSION,
   so each app version gets its own cache and old caches are deleted on activate.
   Cache-first: the app shell, scripts, 3D model and thumbnails are stored on install;
   full photos, fonts and anything else same-origin/CDN are stored the first time they load.
   Map tiles (server.arcgisonline.com, Esri) are NOT cached: Esri's terms on offline tile storage
   have not been checked, so the map background needs a connection. */
const CACHE = 'westies-v' + (new URL(location).searchParams.get('v') || '0');
const nn = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'locations.js', 'statue.js', 'game.js',
  'model/westie-model.js', 'photos/photos.js', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  ...nn.map(n => `photos/thumbs/${n}.jpg`),
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'
];
const NO_CACHE = /(^|\.)arcgisonline\.com$/; // Esri tiles: network only, see note above

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('westies-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || NO_CACHE.test(url.hostname) || !url.protocol.startsWith('http')) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    // index.html?cert=1 / #s5 / ./ all share the one cached page
    const hit = await c.match(req, { ignoreSearch: req.mode === 'navigate' }) || (req.mode === 'navigate' && await c.match('index.html'));
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') c.put(req, res.clone()).catch(() => {}); // quota full: still serve it
    return res;
  })());
});
