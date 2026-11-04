// ОПОРА · Мій день — ядро: стан, навігація, оновлення часу, тема, офлайн-режим.
import * as L from './logic.js';
import * as store from './store.js';
import { $, icon, toast, closeSheet, initDialogs } from './ui.js';
import today from './view-today.js';
import morning from './view-morning.js';
import tasks from './view-tasks.js';
import musts from './view-musts.js';
import settings from './view-settings.js';

const VERSION = '1.0.0';

const VIEWS = { today, morning, tasks, musts };
const TABS = [
  { id: 'today', name: 'Сьогодні', icon: 'sun' },
  { id: 'morning', name: 'Ранок', icon: 'sunrise' },
  { id: 'tasks', name: 'Справи', icon: 'list' },
  { id: 'musts', name: 'Обов’язкові', icon: 'pin' },
];

const app = {
  version: VERSION,
  state: null,
  tab: 'today',
  day: '',
  standalone: false,
  ui: { showDone: false, showMustDone: false, qPr: 2, qTomorrow: false },
  get today() { return L.todayKey(); },
  commit(fn, { render = true } = {}) {
    fn(this.state);
    store.save(this.state);
    if (render) this.render();
  },
  go(tab) {
    if (!VIEWS[tab]) return;
    const same = tab === this.tab;
    this.tab = tab;
    this.render();
    window.scrollTo({ top: 0, behavior: same ? 'smooth' : 'auto' });
  },
  render() {
    const view = $('#view');
    const ae = document.activeElement;
    const keepId = ae && ae.id && view.contains(ae) ? ae.id : '';
    view.innerHTML = VIEWS[this.tab].render(this);
    if (keepId) document.getElementById(keepId)?.focus({ preventScroll: true });
    renderChrome();
    observeTitle();
    this.onRender?.();
  },
  applyTheme,
  onRender: null,
};

const ACTIONS = {
  tab: (a, el) => a.go(el.dataset.tab),
  sheetClose: () => closeSheet(),
  ...today.actions,
  ...morning.actions,
  ...tasks.actions,
  ...musts.actions,
  ...settings.actions,
};

/* ---------- Події (одне делегування на весь документ) ---------- */

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
  const fn = ACTIONS[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  fn(app, el, e);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el) ACTIONS[el.dataset.change]?.(app, el, e);
});
document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-submit]');
  if (!form) return;
  e.preventDefault();
  ACTIONS[form.dataset.submit]?.(app, form, e);
});

/* ---------- Верхня й нижня панелі ---------- */

function buildChrome() {
  $('#tabbar').innerHTML = TABS.map((t) => `
    <button type="button" class="tab" data-act="tab" data-tab="${t.id}" aria-label="${t.name}">
      <span class="tab-ic">${icon(t.icon)}<span class="badge" hidden></span></span>
      <span class="tab-label">${t.name}</span>
    </button>`).join('');
  $('#tbActions').innerHTML = `
    <button type="button" class="icon-btn" data-act="openAdd" aria-label="Додати справу">${icon('plus')}</button>
    <button type="button" class="icon-btn" data-act="openSettings" aria-label="Налаштування">${icon('gear')}</button>`;
}

function renderChrome() {
  for (const b of document.querySelectorAll('.tab')) {
    const on = b.dataset.tab === app.tab;
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  const tv = L.taskView(app.state.tasks, app.today);
  const badge = (tab, n, label) => {
    const el = $(`.tab[data-tab="${tab}"] .badge`);
    el.hidden = !n;
    el.textContent = n > 99 ? '99+' : String(n);
    $(`.tab[data-tab="${tab}"]`).setAttribute('aria-label', n ? `${TABS.find((t) => t.id === tab).name}, ${label} ${n}` : TABS.find((t) => t.id === tab).name);
  };
  badge('tasks', tv.overdue.length, 'прострочено');
  $('#tbTitle').textContent = VIEWS[app.tab].title;
}

let io = null;
function observeTitle() {
  io?.disconnect();
  const bar = $('.topbar');
  const h = $('#view .large-title');
  if (!h || !('IntersectionObserver' in window)) { bar.classList.add('compact'); return; }
  io = new IntersectionObserver(([entry]) => bar.classList.toggle('compact', !entry.isIntersecting), {
    rootMargin: `-${bar.offsetHeight}px 0px 0px 0px`,
  });
  io.observe(h);
}

/* ---------- Тема ---------- */

function applyTheme() {
  const t = app.state.settings.theme;
  const root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme'); else root.dataset.theme = t;
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  metas.forEach((m) => {
    const light = m.media.includes('light');
    m.content = t === 'auto' ? (light ? '#F2F2F7' : '#000000') : t === 'dark' ? '#000000' : '#F2F2F7';
  });
}

/* ---------- Час: щохвилинне оновлення, новий день ---------- */

function tick() {
  const d = L.todayKey();
  const newDay = d !== app.day;
  if (newDay) {
    app.day = d;
    L.purge(app.state);
    store.save(app.state);
  }
  const busy = $('#sheet').open || document.activeElement?.matches?.('input, textarea, select');
  if (busy) return;
  if (newDay || app.tab === 'today' || app.tab === 'morning') app.render();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') tick();
  else store.flush();
});
window.addEventListener('pagehide', () => { store.flush(); });

// Висота екранної клавіатури — щоб нижня панель не ховалася під нею.
function trackKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  const set = () => {
    const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    document.documentElement.style.setProperty('--kb', `${kb}px`);
  };
  vv.addEventListener('resize', set);
  vv.addEventListener('scroll', set);
  set();
}

/* ---------- Офлайн і оновлення ---------- */

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  const offer = (worker) => toast('Доступна нова версія ОПОРА', { label: 'Оновити', run: () => worker.postMessage('skip-waiting') }, Infinity);
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
      });
    });
  }).catch(() => { /* без Service Worker застосунок працює онлайн */ });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    store.flush().finally(() => location.reload());
  });
}

/* ---------- Запуск ---------- */

async function boot() {
  const { state } = await store.load();
  app.state = L.purge(state);
  app.day = L.todayKey();
  app.standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  buildChrome();
  initDialogs();
  trackKeyboard();
  app.render();
  document.documentElement.classList.add('ready');
  setInterval(tick, 15000);
  store.persistence(true);
  registerSW();
}

boot().catch((err) => {
  $('#view').innerHTML = `<div class="page"><h1 class="large-title">ОПОРА</h1>
    <div class="card pad"><p>Не вдалося запустити застосунок. Оновіть сторінку.</p><p class="muted small">${String(err?.message || err).replace(/[<>&]/g, '')}</p></div></div>`;
});
