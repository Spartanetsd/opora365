// ОПОРА — Service Worker: кешує лише файли застосунку, щоб він відкривався без інтернету.
// Особисті дані сюди не потрапляють: вони живуть в IndexedDB/localStorage на пристрої.
// Після зміни будь-якого файлу збільште VERSION — застосунок запропонує оновитися.
const VERSION = 'opora-1.0.0';

const FILES = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './logic.js',
  './store.js',
  './ui.js',
  './view-today.js',
  './view-morning.js',
  './view-tasks.js',
  './view-musts.js',
  './view-settings.js',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('opora-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const root = new URL('./', self.registration.scope).pathname;
  if (req.mode === 'navigate') {
    // Головна сторінка застосунку — з кешу (працює офлайн); інші сторінки — з мережі.
    if (url.pathname === root || url.pathname === `${root}index.html`) {
      event.respondWith(caches.match('./index.html').then((hit) => hit || fetch(req)));
    }
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)),
  );
});
