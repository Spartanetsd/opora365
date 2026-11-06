// ОПОРА 365 — Service Worker: кешує лише файли застосунку, щоб він відкривався без інтернету.
// Особисті дані сюди не потрапляють: вони живуть в IndexedDB/localStorage на пристрої.
// Після зміни будь-якого файлу збільште VERSION — застосунок запропонує оновитися.
const VERSION = 'opora-3.1.0';

const FILES = [
  './',
  './index.html',
  './styles.css',
  './theme.js',
  './app.js',
  './time.js',
  './logic.js',
  './logic-gear.js',
  './logic-deck.js',
  './store.js',
  './icons.js',
  './ui.js',
  './components.js',
  './view-home.js',
  './view-morning.js',
  './view-tasks.js',
  './view-gear.js',
  './view-deck.js',
  './view-tools.js',
  './view-stats.js',
  './view-evening.js',
  './view-settings.js',
  './view-welcome.js',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  // Зображення: усі потрібні для роботи без інтернету.
  './hero-landscape.webp',
  './light-theme.webp',
  './morning-flow.webp',
  './readiness-visual.webp',
  './quick-action-visual.webp',
  './empty-tasks.webp',
  './empty-equipment.webp',
  './onboarding.webp',
  './abstract-01.webp',
  './abstract-02.webp',
  './abstract-03.webp',
  './abstract-04.webp',
  './abstract-05.webp',
  './abstract-06.webp',
  './abstract-07.webp',
  './abstract-08.webp',
  './abstract-09.webp',
  './tests.html',
  './tests.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    // Усі файли або нічого: напівоновлений кеш не активується, лишається попередня версія.
    const cache = await caches.open(VERSION);
    await cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })));
    // Перехід з першої версії (1.x) — автоматичний. Наступні оновлення — кнопкою «Оновити».
    const keys = await caches.keys();
    if (keys.some((k) => /^opora-1\./.test(k))) await self.skipWaiting();
  })());
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
    // Головна сторінка — з кешу (працює офлайн); якщо кешу ще немає — з мережі.
    if (url.pathname === root || url.pathname === `${root}index.html`) {
      event.respondWith(caches.match('./index.html').then((hit) => hit || fetch(req)));
    }
    return;
  }
  event.respondWith(
    caches.open(VERSION).then((cache) => cache.match(req, { ignoreSearch: true })).then((hit) => hit || fetch(req)),
  );
});
