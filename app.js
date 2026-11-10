// ОПОРА 365 — ядро: стан, чотири вкладки й вкладені сторінки, фонові зображення, оновлення часу,
// тема й режим, офлайн, обробка помилок.
import * as L from './logic.js';
import * as G from './logic-gear.js';
import * as store from './store.js';
import { $, $$, esc, icon, toast, closeSheet, initDialogs, reduceMotion, setHaptics, screenOpen } from './ui.js';
import { animateRings, errorState } from './components.js';
import home from './view-home.js';
import morning from './view-morning.js';
import tasks from './view-tasks.js';
import gear from './view-gear.js';
import deck from './view-deck.js';
import tools from './view-tools.js';
import stats from './view-stats.js';
import ideas from './view-ideas.js';
import evening from './view-evening.js';
import settings, { openMenu } from './view-settings.js';
import welcome, { openWelcome } from './view-welcome.js';

const VERSION = '3.3.2';

const VIEWS = { home, morning, tasks, gear, deck, tools, stats, ideas };
const TABS = [
  { id: 'home', name: 'Сьогодні', icon: 'sun' },
  { id: 'gear', name: 'Готовність', icon: 'shieldCheck' },
  { id: 'deck', name: 'Швидка дія', icon: 'chevrons' },
  { id: 'stats', name: 'Статистика', icon: 'chart' },
];
// Вкладені сторінки: до якої вкладки належать і куди веде «Назад».
const PARENT = { morning: 'home', tasks: 'home', ideas: 'home', tools: 'deck' };
const PARENT_NAME = { home: 'Сьогодні', gear: 'Готовність', deck: 'Швидка дія', stats: 'Статистика' };
// Розділи зі своїм кольором (styles.css: :root[data-sec]); «Сьогодні» й «Мій ранок» — у кольорі пори доби.
const SECTIONS = new Set(['tasks', 'ideas', 'gear', 'deck', 'tools', 'stats']);

const app = {
  version: VERSION,
  state: null,
  route: { tab: 'home', sub: '' },
  day: '',
  minute: -1,
  standalone: false,
  ui: { flash: '', qPr: 2, qTomorrow: false, toolQ: '', toolCat: '', toolEdit: false, taskSeg: 'work', taskQ: '', taskCat: '', showMoreMusts: false, modeLen: 'day' },
  get today() { return L.todayKey(); },
  get view() { return VIEWS[this.route.tab]; },
  isLight() {
    const t = this.state?.settings.theme || 'dark';
    return t === 'light' || (t === 'auto' && matchMedia('(prefers-color-scheme: light)').matches);
  },
  commit(fn, { render = true } = {}) {
    fn(this.state);
    store.save(this.state);
    applyMode();
    if (render) this.render();
  },
  go(tab, sub = '', { replace = false } = {}) {
    if (!VIEWS[tab]) return;
    const same = tab === this.route.tab && sub === this.route.sub;
    // Підпис «Назад» — назва сторінки, яку залишаємо (для вкладки — назва розділу).
    const leaving = this.route;
    const lv = VIEWS[leaving.tab];
    const back = leaving.sub || PARENT[leaving.tab] ? (typeof lv.title === 'function' ? lv.title(this) : lv.title) : PARENT_NAME[leaving.tab] || '';
    this.route = { tab, sub };
    const hash = `#${tab}${sub ? `/${sub}` : ''}`;
    if (location.hash !== hash) {
      // Вкладки не накопичують історію; вкладені сторінки — так, щоб «Назад» повертав на місце.
      const nested = !!sub || !!PARENT[tab];
      if (nested && !replace) {
        // «Назад» підписано тим, куди він веде (зі «Статистики» в «Мій ранок» — «‹ Статистика»);
        // підпис зберігається в самому записі історії, тож після повернення він правильний.
        history.pushState({ sub: true, back }, '', hash);
      } else history.replaceState('root', '', hash);
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
    document.documentElement.dataset.sec = SECTIONS.has(this.route.tab) ? this.route.tab : '';
    setBackdrop(mod.backdrop ? mod.backdrop(this) : null);
    fitBackdrop();
    renderChrome();
    animateRings(view);
    try { mod.after?.(this, view); } catch (err) { console.error(err); }
    observeTitle();
    liveTick();
    this.minute = Math.floor(L.localMin());
  },
  applyTheme,
  applyMode,
};

const ACTIONS = {
  tab: (a, el) => a.go(el.dataset.tab, el.dataset.sub || ''),
  back: () => {
    if (history.state?.sub) history.back();
    else app.go(PARENT[app.route.tab] || app.route.tab);
  },
  sheetClose: () => closeSheet(),
  reload: () => location.reload(),
  openMenu: () => openMenu(app),
  ...home.actions,
  ...morning.actions,
  ...tasks.actions,
  ...gear.actions,
  ...deck.actions,
  ...tools.actions,
  ...stats.actions,
  ...ideas.actions,
  ...evening.actions,
  ...settings.actions,
  ...welcome.actions,
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

// Старі адреси версії 2 (#morning, #tasks, #tools) працюють і далі.
function parseHash() {
  const [t, sub = ''] = location.hash.replace(/^#/, '').split('/');
  if (VIEWS[t]) return { tab: t, sub: VIEWS[t].validSub ? VIEWS[t].validSub(app, sub) : '' };
  return { tab: 'home', sub: '' };
}

/* ---------- Фонове зображення сторінки ---------- */
// Живе поза вмістом: щохвилинне оновлення сторінки не перемальовує картинку.
// Зображення розділів декодуються заздалегідь і лишаються в памʼяті (≈35 МБ), тож під час
// перемикання вкладок картинка змінюється в тому ж кадрі, що й вміст, — без запізнення.

const bdPool = new Map(); // src → { img, ready, done }
function bdImage(src) {
  let e = bdPool.get(src);
  if (e) return e;
  const img = new Image();
  img.alt = '';
  img.className = 'bd-img';
  img.src = src;
  const wait = img.decode ? img.decode() : new Promise((ok) => { img.onload = ok; img.onerror = ok; });
  e = { img, done: false };
  e.ready = wait.catch(() => {}).then(() => { e.done = true; });
  bdPool.set(src, e);
  return e;
}

function setBackdrop(spec) {
  const el = $('#backdrop');
  const key = spec ? `${spec.src}|${spec.kind}|${spec.pos || ''}|${spec.h || ''}|${spec.art || ''}|${spec.ah || ''}` : '';
  const root = document.documentElement;
  root.dataset.bd = spec ? spec.kind : '';
  root.dataset.art = spec?.art || '';
  // «Сцена»: висота й пропорції ілюстрації задає сторінка.
  if (spec?.h) root.style.setProperty('--stage-h', spec.h); else root.style.removeProperty('--stage-h');
  if (spec?.ar) root.style.setProperty('--art-ar', spec.ar); else root.style.removeProperty('--art-ar');
  if (spec?.ah) root.style.setProperty('--art-h', spec.ah); else root.style.removeProperty('--art-h');
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  if (!spec) { el.hidden = true; el.querySelectorAll('.bd-img').forEach((o) => o.remove()); return; }
  el.hidden = false;
  el.dataset.kind = spec.kind;
  if (spec.art) el.dataset.art = spec.art; else delete el.dataset.art;
  if (!el.querySelector('.bd-shade')) el.insertAdjacentHTML('beforeend', '<div class="bd-shade"></div>');
  const e = bdImage(spec.src);
  const img = e.img;
  img.style.objectPosition = spec.pos || 'center';
  // Попередня картинка зникає одразу: вона не повинна на мить зʼявлятися в рамці нового розділу.
  el.querySelectorAll('.bd-img').forEach((o) => { if (o !== img) o.remove(); });
  if (img.parentElement !== el) el.prepend(img);
  if (e.done || reduceMotion()) { img.classList.remove('incoming'); return; }
  // Перший показ, картинка ще декодується: тло рамки, потім коротка поява.
  img.classList.add('incoming');
  e.ready.then(() => requestAnimationFrame(() => img.classList.remove('incoming')));
}

// Після запуску по черзі готуємо картинки решти розділів (і другої теми для «Сьогодні»).
function prewarmBackdrops() {
  const srcs = new Set();
  for (const v of Object.values(VIEWS)) {
    try { const s = v.backdrop?.({ ...app, route: { tab: '', sub: '' } }); if (s) srcs.add(s.src); } catch { /* немає зображення */ }
  }
  const list = [...srcs];
  const next = () => {
    const src = list.shift();
    if (src) bdImage(src).ready.then(() => setTimeout(next, 80));
  };
  setTimeout(next, 700);
}

// Зображення завжди не нижче за заголовок над ним: на iPhone з високою «чубчиком» зоною
// вміст (час виходу, відлік, стан) не повинен вилазити за край картинки.
let fitRO = null;
function fitBackdrop() {
  const el = $('#backdrop');
  const head = $('#view .ph, #view .today');
  fitRO?.disconnect();
  if (el.hidden || !head) { el.style.removeProperty('--fit'); return; }
  // Низ заголовка — за розміткою, а не за екраном: під час появи сторінки вона ще зсунута
  // анімацією, і виміряний «на льоту» край був би нижчим на ці пікселі.
  const set = () => {
    let y = head.offsetHeight;
    for (let e = head; e; e = e.offsetParent) y += e.offsetTop;
    el.style.setProperty('--fit', `${Math.ceil(y + (el.dataset.kind === 'hero' ? 8 : 16))}px`);
  };
  set();
  if ('ResizeObserver' in window) { fitRO = new ResizeObserver(set); fitRO.observe(head); }
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
  const tabNow = PARENT[app.route.tab] || app.route.tab;
  for (const b of $$('.tab')) {
    const on = b.dataset.tab === tabNow;
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  const today = app.today;
  const tv = L.taskView(app.state.tasks, today);
  const mv = L.mustView(app.state.musts, today);
  const mustLate = mv.active.filter((m) => m.left !== null && m.left < 0).length;
  const late = tv.overdue.length + mustLate;
  const issues = G.gearSummary(app.state.gear).issues;
  const badge = (tab, n, label) => {
    const b = $(`.tab[data-tab="${tab}"]`);
    const el = b.querySelector('.badge');
    const name = TABS.find((t) => t.id === tab).name;
    el.hidden = !n;
    el.textContent = n > 99 ? '99+' : String(n);
    b.setAttribute('aria-label', n ? `${name}, ${label}` : name);
  };
  // Значок «Сьогодні» = «Прострочено» + «Не забути: строк минув» з «Пульсу дня».
  badge('home', late, [tv.overdue.length ? `прострочено ${tv.overdue.length}` : '', mustLate ? `«Не забути» після строку: ${mustLate}` : ''].filter(Boolean).join(', '));
  badge('gear', issues, `потребують уваги ${issues}`);
  const mod = app.view;
  const ch = mod.chrome ? mod.chrome(app) : {};
  const nested = !!app.route.sub || !!PARENT[app.route.tab];
  const parent = PARENT[app.route.tab] || app.route.tab;
  // Після перезапуску на вкладеній сторінці історії немає — тоді «Назад» веде до батьківського розділу.
  const backTo = (history.state?.sub && history.state.back) || PARENT_NAME[parent];
  const back = nested ? `<button type="button" class="back-btn" data-act="back">${icon('back')}<span>${esc(ch.backLabel || backTo || 'Назад')}</span></button>` : '';
  $('#tbLeft').innerHTML = back || ch.left || '';
  $('#tbActions').innerHTML = (ch.right || '') + `<button type="button" class="icon-btn" data-act="openMenu" aria-label="Меню: ранок, справи, інструменти, налаштування">${icon('more')}</button>`;
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

const META_BG = { dark: '#080D16', light: '#EEF3F8' };
function applyTheme() {
  const t = app.state.settings.theme;
  const root = document.documentElement;
  root.dataset.theme = t;
  root.dataset.scheme = app.isLight() ? 'light' : 'dark';
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = app.isLight() ? META_BG.light : META_BG.dark;
  try { localStorage.setItem('opora.theme', t); } catch { /* сховище недоступне */ }
}
function applyMode() {
  document.documentElement.dataset.mode = L.modeInfo(app.state).id;
}

/* ---------- Час: щохвилинне оновлення, новий день, живі відліки ---------- */

// Сторінку не перемальовуємо лише тоді, коли людина вводить текст у самій сторінці.
// Відкрита нижня панель не заважає: вона окремо, а числа під нею (ранок, пульс) мають бути свіжими.
function busy() {
  return !!document.activeElement?.matches?.('#view input, #view textarea, #view select') || document.documentElement.classList.contains('dragging');
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

// Зворотні відліки (вихід, таймер «Фокусу») оновлюються щосекунди лише власним текстом.
function liveTick() {
  if (document.hidden) return;
  const nowMs = Date.now();
  for (const el of document.querySelectorAll('[data-count-to]')) {
    const left = Math.round((+el.dataset.countTo - nowMs) / 1000);
    el.textContent = L.fmtClock(left);
    if (left <= 0 && el.dataset.fin && !el.dataset.fired) {
      el.dataset.fired = '1';
      app.screenTick?.();
    }
  }
}
setInterval(liveTick, 1000);

document.addEventListener('visibilitychange', () => {
  const vis = document.visibilityState === 'visible';
  document.documentElement.classList.toggle('hidden', !vis);
  if (vis) { tick(); liveTick(); checkUpdate(); } else store.flush();
});
window.addEventListener('pagehide', () => { store.flush(); });

// Екранна клавіатура. iOS не стискає сторінку, а показує лише її частину над клавіатурою
// і може зсунути цю частину вниз (якщо поле в момент фокуса було під клавіатурою, напр. під час
// появи панелі). Тому панелі й екрани прив'язані до видимої частини: --vvt — де вона починається,
// --vvh — її висота, --kb — скільки сторінки під нею. Поле, в яке пишете, прокручується у видиму зону.
function trackKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  // Клавіатура буває лише тоді, коли пишете в поле. Без поля у фокусі будь-які «залишки» розмірів —
  // хибні: iOS після згортання застосунку чи клавіатури інколи віддає старі або нульові розміри,
  // і тоді панель «Нова справа» відʼїжджала за край, лишаючи на екрані тільки розмитий фон.
  const editing = () => !!document.activeElement?.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]), textarea, select');
  const set = () => {
    const H = window.innerHeight;
    const pinched = vv.scale > 1.01; // збільшення пальцями — не клавіатура
    let top = Math.max(0, Math.round(vv.offsetTop));
    let h = Math.round(vv.height);
    const sane = !pinched && editing() && h >= 160 && h <= H + 1 && top <= H - 160;
    if (!sane) { top = 0; h = H; }
    const kb = sane ? Math.min(H - 160, Math.max(0, Math.round(H - vv.height - vv.offsetTop))) : 0;
    root.style.setProperty('--kb', `${kb}px`);
    root.style.setProperty('--vvt', `${top}px`);
    root.style.setProperty('--vvh', `${h}px`);
    const open = sane && H - h > 80;
    root.classList.toggle('kb-open', open);
    if (open) requestAnimationFrame(revealFocused);
  };
  // Повторна звірка: клавіатура зʼявляється й ховається з анімацією, а iOS не завжди повідомляє про кінець.
  const settle = () => { set(); setTimeout(set, 120); setTimeout(set, 450); };
  vv.addEventListener('resize', set);
  vv.addEventListener('scroll', set);
  addEventListener('resize', set);
  addEventListener('orientationchange', settle);
  addEventListener('pageshow', settle);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) settle(); });
  document.addEventListener('focusin', () => {
    settle();
    if (!root.classList.contains('kb-open')) return;
    setTimeout(revealFocused, 60);
    setTimeout(revealFocused, 360);
  });
  // Перехід між полями — спершу focusout, одразу focusin: звіряємо трохи згодом, щоб панель не смикалась.
  document.addEventListener('focusout', () => { setTimeout(set, 60); setTimeout(set, 450); });
  set();
}

// Поле у фокусі — у видимій частині своєї панелі чи екрана: не під заголовком, не під закріпленою кнопкою.
function revealFocused() {
  const a = document.activeElement;
  if (!a || !a.matches('input:not([type=checkbox]):not([type=radio]), textarea, select')) return;
  const box = a.closest('.sheet-body, .scr, #view');
  if (!box || box.id === 'view') return;
  const r = a.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  const foot = box.querySelector('.scr-foot');
  const footH = foot && !foot.contains(a) ? foot.getBoundingClientRect().height : 0;
  // Екран: верхній відступ уже містить зону годинника й нерухомий заголовок.
  const pad = box.classList.contains('scr') ? parseFloat(getComputedStyle(box).paddingTop) || 0 : 0;
  const top = b.top + pad + 12;
  const bottom = b.bottom - footH - 12;
  if (r.top < top) box.scrollTop -= top - r.top;
  else if (r.bottom > bottom) box.scrollTop += Math.min(r.bottom - bottom, r.top - top);
}

window.addEventListener('scroll', () => {
  if (!$('#view [data-title-anchor]')) $('#topbar').classList.toggle('compact', window.scrollY > 4);
}, { passive: true });

/* ---------- Офлайн і контроль оновлення ---------- */

let swReg = null;
let lastCheck = 0;
let offered = null;

// Нова версія готова: пропонуємо оновитися. Повторно — після повернення в застосунок.
function offerUpdate(worker, again = false) {
  if (!worker || !navigator.serviceWorker.controller) return;
  if (offered === worker && !again) return;
  offered = worker;
  toast('Доступна нова версія ОПОРА 365', { label: 'Оновити', run: () => { store.flush().finally(() => worker.postMessage('skip-waiting')); } }, Infinity);
}

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
  const { state, fresh } = await store.load();
  app.state = L.purge(state);
  // Ранок, завершений до оновлення, теж потрапляє в «Статистику».
  if (L.logMorning(app.state)) store.save(app.state);
  app.day = L.todayKey();
  app.standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  setHaptics(app.state.settings.haptics);
  applyTheme();
  applyMode();
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => { applyTheme(); app.render(); });
  buildChrome();
  initDialogs();
  // Рамка фокусу — лише для клавіатури: Tab і стрілки вмикають її, дотик вимикає.
  addEventListener('keydown', (e) => {
    if (e.key === 'Tab' || (e.key.startsWith('Arrow') && !e.target.closest?.('input, textarea, select'))) document.documentElement.classList.add('kbd');
  }, true);
  addEventListener('pointerdown', () => document.documentElement.classList.remove('kbd'), true);
  trackKeyboard();
  app.route = parseHash();
  history.replaceState('root', '', `#${app.route.tab}${app.route.sub ? `/${app.route.sub}` : ''}`);
  app.render({ enter: true });
  document.documentElement.classList.add('ready');
  prewarmBackdrops();
  scheduleTick();
  setInterval(tick, 20000);
  store.persistence(true);
  registerSW();
  if (store.status.migratedFrom) {
    store.save(app.state);
    toast('ОПОРА 365 оновлено: чотири розділи й новий вигляд. Дані збережено', null, 5600, 'check');
  }
  if (!app.state.settings.onboarded && fresh) openWelcome(app);
  else if (!app.state.settings.onboarded) app.commit((s) => { s.settings.onboarded = true; }, { render: false });
}

boot().catch((err) => {
  console.error(err);
  $('#view').innerHTML = `<div class="page" style="padding-top:12vh">${errorState({ title: 'Не вдалося запустити ОПОРА 365', text: 'Спробуйте оновити сторінку. Якщо помилка повторюється — перезапустіть застосунок з іконки.', detail: String(err?.message || err) })}</div>`;
  document.documentElement.classList.add('ready');
});

export default app;
