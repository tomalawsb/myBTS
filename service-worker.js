'use strict';

const CACHE_NAME = 'mybts-web-pro-v3-19-1905260655';
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data-worker.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './stations_sample.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.pathname.endsWith('/stations.json') || url.pathname.endsWith('/stations.json.br') || url.pathname.endsWith('/stations.json.gz')) {
    event.respondWith(networkOnly(request));
    return;
  }

  if (request.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.hostname.includes('cdnjs.cloudflare.com') || url.hostname.includes('cdn.sheetjs.com')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(fetch(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (_) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return fetch(request);
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || network;
}

async function networkOnly(request) {
  return fetch(request, { cache: 'no-store' });
}
