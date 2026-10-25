// Service worker DVB-T/T2 Point. Usuwa WYŁĄCZNIE własne stare cache 'dvbt-point-app-*'; nie dotyka innych SW ani cache terenu.
const VERSION = '3 v25.10.26.1235';
const CACHE = 'dvbt-point-app-' + VERSION.replace(/\s+/g, '_');
const CORE = [
  './', './index.html', './manifest.json', './css/style.css', './css/layout.css',
  './vendor/leaflet/leaflet.js', './vendor/leaflet/leaflet.css',
  './vendor/leaflet/images/marker-icon.png', './vendor/leaflet/images/marker-icon-2x.png', './vendor/leaflet/images/marker-shadow.png', './vendor/leaflet/images/layers.png',
  './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png',
  './js/core/version.js', './js/core/geo.js', './js/core/rf.js', './js/core/ant.js', './js/core/txdata.js', './js/core/errors.js', './js/core/state.js', './js/core/compass-math.js', './js/core/rank.js', './js/core/txstyle.js', './js/core/p1812.js', './js/core/landcover.js', './js/core/propagation.js', './js/core/puwg92.js', './js/core/coverage.js', './js/core/areanode.js', './js/app/clutter.js', './js/app/nmt.js', './assets/icon-maskable-512.png', './assets/favicon-32.png',
  './js/app/main.js', './js/app/dom.js', './js/app/dem.js', './js/app/area.js', './js/app/area-worker.js', './js/app/storage.js', './js/app/geocode.js', './js/app/compass.js', './js/app/profile-chart.js', './js/app/reference.js',
  './data/transmitters.json'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('dvbt-point-app-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // mapy, teren, Nominatim — obsługuje aplikacja (teren: własny cache w dem.js)
  const isData = url.pathname.includes('/data/');
  if (isData){
    // Dane: najpierw sieć (świeża baza), offline — kopia z cache (bez parametrów zapytania).
    e.respondWith(fetch(req).then(r => { if (r.ok){ const cp = r.clone(); caches.open(CACHE).then(c => c.put(url.pathname.endsWith('.json') ? new Request(url.origin + url.pathname) : req, cp)); } return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || new Response('', { status: 504, statusText: 'offline' }))));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req).then(resp => {
    if (resp.ok && resp.type === 'basic'){ const cp = resp.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
    return resp;
  }).catch(() => req.mode === 'navigate' ? caches.match('./index.html') : new Response('', { status: 504 }))));
});
