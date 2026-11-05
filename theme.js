// ОПОРА 365 — тема до першого кадру: без спалаху іншої теми під час запуску.
// Звичайний (не модульний) скрипт у <head>; тема зберігається окремо від даних.
(function () {
  try {
    var t = localStorage.getItem('opora.theme') || 'dark';
    var light = t === 'light' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches);
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.setAttribute('data-scheme', light ? 'light' : 'dark');
    var bar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (bar && light) bar.setAttribute('content', 'default');
    var tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute('content', light ? '#EEF3F8' : '#080D16');
  } catch (e) { /* сховище недоступне — лишається темна тема */ }
})();
