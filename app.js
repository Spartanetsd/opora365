// ОПОРА 365 — ядро: стан, маршрути, оновлення часу, тема й режим, офлайн, обробка помилок.
import * as L from './logic.js';
import * as store from './store.js';
import { $, $$, icon, toast, closeSheet, initDialogs, reduceMotion, setHaptics, screenOpen } from './ui.js';
import { animateRings, scrollDaylines, errorState } from './components.js';
import home from './view-home.js';
import morning from './view-morning.js';
import tasks from './view-tasks.js';
import gear from './view-gear.js';
import deck from './view-deck.js';
import tools from './view-tools.js';
import settings from './view-settings.js';

const VERSION = '2.0.1';

const VIEWS = { home, morning, tasks, gear, deck, tools };
const TABS = [
  { id: 'home', name: 'Сьогодні', icon: 'orb' },
  { id: 'morning', name: 'Ранок', icon: 'sunrise' },
  { id: 'tasks', name: 'Справи', icon: 'list' },
  { id: 'gear', name: 'Екіпірування', icon: 'shieldCheck' },
  { id: 'deck', name: 'Швидко', icon: 'deck' },
];
const TAB_OF = { tools: 'deck' };

const app = {
  version: VERSION,
  state: null,
  route: { tab: 'home', sub: '' },
  day: '',
  minute: -1,
  standalone: false,
  ui: { flash: '', showDone: false, showMore: false, showMustDone: false, showUpcoming: false, qPr: 2, qTomorrow: false, toolQ: '', toolCat: '', toolEdit: false },
  get today() { return L.todayKey(); },
  get view() { return VIEWS[this.route.tab]; },
  commit(fn, { render = true } = {}) {
    fn(this.state);
    store.save(this.state);
    applyMode();
    if (render) this.render();
  },
  go(tab, sub = '', { replace = false } = {}) {
    if (!VIEWS[tab]) return;
    const same = tab === this.route.tab && sub === this.route.sub;
    this.route = { tab, sub };
    const hash = `#${tab}${sub ? `/${sub}` : ''}`;
    if (location.hash !== hash) {
      // Вкладки не накопичують історію; вкладені сторінки — так, щоб працював жест «назад».
      if (sub && !replace) history.pushState('sub', '', hash);
      else history.replaceState('root', '', hash);
    }
    this.render({ enter: !same });
    window.scrollTo({ top: 0, behavior: same && !reduceMotion() ? 'smooth' : 'auto' });
  },
  render({ enter = false } = {}) {
    const view = $('#view');
    const mod = this.view;
    let html;
    try {
      html = mod.render(this);
    } catch (err) {
      console.error(err);
      html = `<div class="page">${errorState({ detail: String(err?.message || err) })}</div>`;
    }
    const ae = document.activeElement;
    const keepId = ae && ae.id && view.contains(ae) ? ae.id : '';
    view.innerHTML = html;
    view.classList.toggle('enter', enter && !reduceMotion());
    if (keepId) document.getElementById(keepId)?.focus({ preventScroll: true });
    renderChrome();
    animateRings(view);
    scrollDaylines(view);
    try { mod.after?.(this, view); } catch (err) { console.error(err); }
    observeTitle();
    this.minute = Math.floor(L.localMin());
  },
  applyTheme,
  applyMode,
};

const ACTIONS = {
  tab: (a, el) => a.go(el.dataset.tab, el.dataset.sub || ''),
  back: () => { if (history.state === 'sub') history.back(); else app.go(app.route.tab); },
  sheetClose: () => closeSheet(),
  reload: () => location.reload(),
  ...home.actions,
  ...morning.actions,
  ...tasks.actions,
  ...gear.actions,
  ...deck.actions,
  ...tools.actions,
  ...settings.actions,
};

/* ---------- Події (одне делегування на весь документ) ---------- */

function run(name, el, e) {
  const fn = ACTIONS[name];
  if (!fn) return;
  try {
    const r = fn(app, el, e);
    if (r && typeof r.catch === 'function') r.catch(fail);
  } catch (err) { fail(err); }
}
function fail(err) {
  console.error(err);
  toast('Не вдалося виконати дію. Дані збережено.');
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
  if (el.tagName === 'A' && el.dataset.act === 'toolOpen') { run('toolOpen', el, e); return; }
  e.preventDefault();
  run(el.dataset.act, el, e);
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target.closest('[data-act][role="button"]:not(button)');
  if (!el) return;
  e.preventDefault();
  run(el.dataset.act, el, e);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el) run(el.dataset.change, el, e);
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (el) run(el.dataset.input, el, e);
});
document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-submit]');
  if (!form) return;
  e.preventDefault();
  run(form.dataset.submit, form, e);
});

window.addEventListener('popstate', () => {
  const r = parseHash();
  if (r.tab === app.route.tab && r.sub === app.route.sub) return;
  app.route = r;
  app.render({ enter: true });
});

function parseHash() {
  const [t, sub = ''] = location.hash.replace(/^#/, '').split('/');
  if (VIEWS[t]) return { tab: t, sub: VIEWS[t].validSub ? VIEWS[t].validSub(app, sub) : '' };
  return { tab: 'home', sub: '' };
}

/* ---------- Верхня й нижня панелі ---------- */

function buildChrome() {
  $('#tabbar').innerHTML = TABS.map((t) => `
    <button type="button" class="tab" data-act="tab" data-tab="${t.id}" aria-label="${t.name}">
      <span class="tab-ic">${icon(t.icon)}<span class="badge" hidden></span></span>
      <span class="tab-label">${t.name}</span>
    </button>`).join('');
}

function renderChrome() {
  const tabNow = TAB_OF[app.route.tab] || app.route.tab;
  for (const b of $$('.tab')) {
    const on = b.dataset.tab === tabNow;
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  const today = app.today;
  const tv = L.taskView(app.state.tasks, today);
  const mv = L.mustView(app.state.musts, today);
  const lateMusts = mv.open.filter((m) => m.left !== null && m.left < 0).length;
  const badge = (tab, n, label) => {
    const b = $(`.tab[data-tab="${tab}"]`);
    const el = b.querySelector('.badge');
    const name = TABS.find((t) => t.id === tab).name;
    el.hidden = !n;
    el.textContent = n > 99 ? '99+' : String(n);
    b.setAttribute('aria-label', n ? `${name}, ${label} ${n}` : name);
  };
  badge('tasks', tv.overdue.length + lateMusts, 'прострочено');
  const mod = app.view;
  const ch = mod.chrome ? mod.chrome(app) : {};
  $('#tbLeft').innerHTML = ch.left || '';
  $('#tbActions').innerHTML = (ch.right || '') + `<button type="button" class="icon-btn" data-act="openSettings" aria-label="Налаштування">${icon('gear')}</button>`;
  $('#tbTitle').textContent = typeof mod.title === 'function' ? mod.title(app) : mod.title;
}

let io = null;
function observeTitle() {
  io?.disconnect();
  const bar = $('#topbar');
  const h = $('#view [data-title-anchor]');
  if (!h || !('IntersectionObserver' in window)) { bar.classList.toggle('compact', !!window.scrollY); return; }
  io = new IntersectionObserver(([entry]) => bar.classList.toggle('compact', !entry.isIntersecting), {
    rootMargin: `-${bar.offsetHeight}px 0px 0px 0px`,
  });
  io.observe(h);
}

/* ---------- Тема і режим дня ---------- */

const META_BG = { dark: '#080D16', light: '#F6F2EC' };
function applyTheme() {
  const t = app.state.settings.theme;
  const root = document.documentElement;
  root.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && !matchMedia('(prefers-color-scheme: light)').matches);
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = dark ? META_BG.dark : META_BG.light;
  try { localStorage.setItem('opora.theme', t); } catch { /* сховище недоступне */ }
}
function applyMode() {
  const m = L.modeInfo(app.state).id;
  document.documentElement.dataset.mode = m;
}

/* ---------- Час: щохвилинне оновлення, новий день ---------- */

function busy() {
  return $('#sheet').open || document.activeElement?.matches?.('input, textarea, select') || document.documentElement.classList.contains('dragging');
}

function tick() {
  const d = L.todayKey();
  const newDay = d !== app.day;
  if (newDay) {
    app.day = d;
    L.purge(app.state);
    store.save(app.state);
  }
  applyMode();
  const minute = Math.floor(L.localMin());
  if (!newDay && minute === app.minute) return;
  if (screenOpen()) { app.screenTick?.(); app.minute = minute; return; }
  if (busy()) return;
  app.render();
}

function scheduleTick() {
  const s = L.kyivParts().sec;
  setTimeout(() => { tick(); scheduleTick(); }, Math.max(1000, (60 - s) * 1000 + 150));
}

document.addEventListener('visibilitychange', () => {
  const vis = document.visibilityState === 'visible';
  document.documentElement.classList.toggle('hidden', !vis);
  if (vis) { tick(); checkUpdate(); } else store.flush();
});
window.addEventListener('pagehide', () => { store.flush(); });

// Ореол «дихає», лише коли інтерфейсом користуються — так менше витрачається батарея.
let idleTimer = 0;
function wake() {
  document.documentElement.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.documentElement.classList.add('idle'), 25000);
}
for (const ev of ['pointerdown', 'keydown', 'scroll', 'touchstart']) window.addEventListener(ev, wake, { passive: true });

// Висота екранної клавіатури — щоб панелі не ховалися під нею.
function trackKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  const set = () => {
    const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    document.documentElement.style.setProperty('--kb', `${kb}px`);
    document.documentElement.classList.toggle('kb-open', kb > 80);
  };
  vv.addEventListener('resize', set);
  vv.addEventListener('scroll', set);
  set();
}

window.addEventListener('scroll', () => {
  if (!$('#view [data-title-anchor]')) $('#topbar').classList.toggle('compact', window.scrollY > 4);
}, { passive: true });

/* ---------- Офлайн і контроль оновлення ---------- */

let swReg = null;
let lastCheck = 0;
let offered = null;

// Нова версія готова: пропонуємо оновитися. Повторно — після повернення в застосунок,
// бо повідомлення могло зникнути під іншим.
function offerUpdate(worker, again = false) {
  if (!worker || !navigator.serviceWorker.controller) return;
  if (offered === worker && !again) return;
  offered = worker;
  toast('Доступна нова версія ОПОРА 365', { label: 'Оновити', run: () => { store.flush().finally(() => worker.postMessage('skip-waiting')); } }, Infinity);
}

// Стежимо за версією, що встановлюється. Оновлення могло почати встановлюватися
// ще до реєстрації (перевірку браузер запускає сам під час відкриття сторінки).
function track(worker) {
  if (!worker) return;
  if (worker.state === 'installed') { offerUpdate(worker); return; }
  worker.addEventListener('statechange', () => { if (worker.state === 'installed') offerUpdate(worker); });
}

export function checkUpdate(force = false) {
  if (!swReg) return Promise.resolve('none');
  if (swReg.waiting) { offerUpdate(swReg.waiting, true); return Promise.resolve('found'); }
  if (!force && Date.now() - lastCheck < 30 * 60e3) return Promise.resolve('skip');
  lastCheck = Date.now();
  return swReg.update().then(() => (swReg.waiting || swReg.installing ? 'found' : 'latest')).catch(() => 'offline');
}
app.checkUpdate = checkUpdate;

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    swReg = reg;
    if (reg.waiting) offerUpdate(reg.waiting);
    track(reg.installing);
    reg.addEventListener('updatefound', () => track(reg.installing));
  }).catch(() => { /* без Service Worker застосунок працює онлайн */ });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    store.flush().finally(() => location.reload());
  });
}

/* ---------- Запуск ---------- */

window.addEventListener('error', (e) => console.error(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => console.error(e.reason));

async function boot() {
  const { state } = await store.load();
  app.state = L.purge(state);
  app.day = L.todayKey();
  app.standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  setHaptics(app.state.settings.haptics);
  applyTheme();
  applyMode();
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', applyTheme);
  buildChrome();
  initDialogs();
  trackKeyboard();
  app.route = parseHash();
  history.replaceState('root', '', `#${app.route.tab}${app.route.sub ? `/${app.route.sub}` : ''}`);
  app.render({ enter: true });
  document.documentElement.classList.add('ready');
  wake();
  scheduleTick();
  setInterval(tick, 20000);
  store.persistence(true);
  registerSW();
  if (store.status.migratedFrom) {
    store.save(app.state);
    toast('ОПОРА оновлено до 365: ваші справи й налаштування ранку збережено', null, 5200);
  }
}

boot().catch((err) => {
  console.error(err);
  $('#view').innerHTML = `<div class="page" style="padding-top:12vh">${errorState({ title: 'Не вдалося запустити ОПОРА 365', text: 'Спробуйте оновити сторінку. Якщо помилка повторюється — перезапустіть застосунок з іконки.', detail: String(err?.message || err) })}</div>`;
  document.documentElement.classList.add('ready');
});

export default app;
