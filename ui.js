// ОПОРА 365 — помічники інтерфейсу: екранування, повідомлення, нижні панелі, повноекранні режими,
// тактильний відгук. Під час імпорту модуль не звертається до DOM (його використовують і тести в Node).
import { icon } from './icons.js';

export { icon };
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

// Типографіка: число з одиницею («59 хв», «4 з 5») і прийменник із часом («о 13:44») не розриваються між рядками.
export const typo = (s) => esc(s)
  .replace(/(\d) з (\d)/g, '$1&nbsp;з&nbsp;$2')
  .replace(/(\d) (хв|год|с|днів|дні|день|дня|раз|рази|разів|справ|справи|кроків|кроки|крок)(?=[\s,.;:)]|$)/g, '$1&nbsp;$2')
  .replace(/(^|[\s(])(о|до|з|на|від) (\d{1,2}:\d{2})/g, '$1$2&nbsp;$3');

export const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Тактильний відгук ---------- */
// Android: Vibration API. iPhone: офіційного API для вебзастосунків немає; iOS 18+ дає системний
// відгук під час перемикання <input type="checkbox" switch>, тому використовуємо прихований перемикач.
// Якщо платформа цього не підтримує — просто нічого не відбувається.
let hapticOn = true;
let hapticEl = null;
export function setHaptics(on) { hapticOn = !!on; }
export function haptic() {
  if (!hapticOn) return;
  try {
    if (typeof navigator.vibrate === 'function') { navigator.vibrate(12); return; }
    if (!hapticEl) {
      const label = document.createElement('label');
      label.setAttribute('aria-hidden', 'true');
      label.className = 'haptic';
      label.innerHTML = '<input type="checkbox" switch tabindex="-1">';
      document.body.append(label);
      hapticEl = label;
    }
    hapticEl.click();
  } catch { /* платформа не підтримує */ }
}

/* ---------- Коротке повідомлення ---------- */

let toastTimer = 0;
let toastAt = 0;
// Відкрите модальне вікно перекриває решту сторінки, тому повідомлення показуємо всередині
// верхнього відкритого вікна — інакше його не видно і кнопку «Скасувати» не натиснути.
function toastHost() {
  const open = $$('dialog').filter((d) => d.open && !d.classList.contains('closing'));
  open.sort((a, b) => (+b.dataset.openedAt || 0) - (+a.dataset.openedAt || 0));
  return open[0] || document.body;
}
// Перед заміною вмісту вікна повідомлення виносимо назовні — інакше воно зникне разом зі старим вмістом.
function rescueToast(d) {
  const el = $('#toast');
  if (!el || !d.contains(el)) return false;
  document.body.append(el);
  return el.classList.contains('show');
}
function showModalTop(d) {
  d.showModal();
  d.dataset.openedAt = String(performance.now());
}
// Нове вікно відкрилося, поки видно повідомлення: якщо воно щойно зʼявилося (та сама дія) — переносимо
// його у вікно, щоб його було видно; старе повідомлення просто ховаємо, щоб не закривало кнопки вікна.
function adoptToast(d) {
  const el = $('#toast');
  if (!el || !el.classList.contains('show') || d.contains(el)) return;
  if (performance.now() - toastAt < 400) d.append(el);
  else { el.classList.remove('show'); clearTimeout(toastTimer); }
}
export function homeToast(from) {
  const el = $('#toast');
  if (el && from && from.contains(el)) toastHost().append(el);
}
// ic — піктограма підтвердження (наприклад, 'check' після збереження).
export function toast(message, action = null, ms = 0, ic = '') {
  const el = $('#toast');
  if (!el) return;
  const host = toastHost();
  if (el.parentElement !== host) host.append(el);
  el.innerHTML = `${ic ? `<span class="toast-ic">${icon(ic)}</span>` : ''}<span class="toast-text">${esc(message)}</span>${action ? `<button type="button" class="toast-btn">${esc(action.label)}</button>` : ''}`;
  const hide = () => el.classList.remove('show');
  if (action) el.querySelector('.toast-btn').addEventListener('click', () => { hide(); action.run(); }, { once: true });
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  toastAt = performance.now();
  clearTimeout(toastTimer);
  if (ms !== Infinity) toastTimer = setTimeout(hide, ms || (action ? 5000 : 2600));
}

/* ---------- Нижня панель (BottomSheet) ---------- */

function syncModalClass() {
  const any = $$('dialog').some((d) => d.open);
  document.documentElement.classList.toggle('modal-open', any);
}

// Заголовок вікна («Скасувати — Назва — Готово») виносимо за межі області прокручування:
// прокручений вміст ховається під ним і ніколи не малюється поверх. Кнопки «Готово» лишаються
// повʼязаними зі своєю формою через атрибут form.
let formSeq = 0;
function liftHead(d, sel, before = null) {
  const head = d.querySelector(sel);
  if (!head) return false;
  const form = head.closest('form');
  if (form) {
    if (!form.id) form.id = `vform${++formSeq}`;
    for (const b of head.querySelectorAll('button[type="submit"], button:not([type])')) b.setAttribute('form', form.id);
  }
  if (before) d.insertBefore(head, before); else d.append(head);
  return true;
}

let closeTimer = 0;
export function openSheet(html, { onClose = null, label = 'Панель' } = {}) {
  const d = $('#sheet');
  clearTimeout(closeTimer);
  d.classList.remove('closing', 'dragging');
  d.style.transform = '';
  d.setAttribute('aria-label', label);
  const kept = rescueToast(d);
  d.innerHTML = `<div class="sheet-grab" aria-hidden="true"><span></span></div><div class="sheet-body" tabindex="-1">${html}</div>`;
  liftHead(d, '.sheet-body .sheet-head', d.querySelector('.sheet-body'));
  d.classList.remove('scrolled');
  d.dataset.dirty = '';
  d.onCloseOnce = onClose;
  const f = d.querySelector('[data-focus]');
  // Панель із полем для введення зʼявляється на своєму місці (коротке піднімання), а не з-під краю:
  // у мить фокуса поле вже над клавіатурою, і iOS не зсуває сторінку.
  if (!d.open) d.classList.toggle('soft-in', !!f && f.matches('input:not([type=checkbox]):not([type=radio]), textarea'));
  if (!d.open) showModalTop(d);
  syncModalClass();
  if (kept) d.append($('#toast')); else adoptToast(d);
  if (f) f.focus();
  else d.querySelector('.sheet-body').focus({ preventScroll: true });
  return d;
}

export function closeSheet() {
  const d = $('#sheet');
  if (!d.open || d.classList.contains('closing')) return;
  d.classList.add('closing');
  homeToast(d);
  if (reduceMotion()) { d.close(); return; }
  closeTimer = setTimeout(() => { d.classList.remove('closing'); d.style.transform = ''; if (d.open) d.close(); }, 200);
}

// Чи можна закрити панель жестом або дотиком поза нею. Не можна, якщо у формі вже щось змінено:
// введене не має зникати від випадкового руху. Тоді панель лише «пружинить», а закриває «Скасувати».
const typing = (d) => !!document.activeElement && d.contains(document.activeElement) && document.activeElement.matches('input:not([type="checkbox"]), textarea, select');
function guarded(d) {
  return d.dataset.dirty === '1' && !!d.querySelector('form.sheet-form');
}
function nudge(d) {
  if (reduceMotion() || !d.animate) return;
  d.animate([{ transform: 'none' }, { transform: 'translateY(10px)' }, { transform: 'none' }], { duration: 260, easing: 'ease-out' });
}

// Закрити панель можна, потягнувши донизу смужку вгорі або заголовок панелі.
// Прокручування вмісту (будь-якої сили й напрямку) панель не закриває.
function enableDrag(d) {
  let y0 = 0, x0 = 0, dy = 0, active = false, decided = false, trail = [];
  d.addEventListener('touchstart', (e) => {
    active = false;
    if (e.touches.length !== 1) return;
    if (!e.target.closest('.sheet-grab, .sheet-head')) return;
    if (e.target.closest('button, a, input, textarea, select, label')) return;
    if (typing(d) || document.documentElement.classList.contains('kb-open')) return;
    const t = e.touches[0];
    active = true; decided = false; y0 = t.clientY; x0 = t.clientX; dy = 0; trail = [[e.timeStamp, t.clientY]];
  }, { passive: true });
  d.addEventListener('touchmove', (e) => {
    if (!active) return;
    const t = e.touches[0];
    const ddy = t.clientY - y0, ddx = t.clientX - x0;
    if (!decided) {
      if (Math.abs(ddy) < 8 && Math.abs(ddx) < 8) return;
      decided = true;
      // Лише рух донизу, переважно вертикальний.
      if (ddy <= 0 || Math.abs(ddx) > Math.abs(ddy)) { active = false; return; }
    }
    dy = Math.max(0, ddy);
    trail.push([e.timeStamp, t.clientY]);
    if (trail.length > 6) trail.shift();
    d.classList.add('dragging');
    d.style.transform = `translateY(${guarded(d) ? Math.min(40, dy * 0.25) : dy}px)`;
  }, { passive: true });
  const end = () => {
    if (!active) return;
    active = false;
    d.classList.remove('dragging');
    const [ta, ya] = trail[0], [tb, yb] = trail[trail.length - 1];
    const speed = (yb - ya) / Math.max(1, tb - ta); // пікс/мс на останньому відрізку руху
    const close = decided && (dy > 140 || (dy > 70 && speed > 0.8));
    d.style.transform = '';
    if (close && !guarded(d)) closeSheet();
    else if (close) nudge(d);
  };
  d.addEventListener('touchend', end);
  d.addEventListener('touchcancel', end);
  // Будь-яка зміна у формі панелі: далі закривати лише кнопкою.
  const mark = (e) => { if (e.target.closest('form.sheet-form')) d.dataset.dirty = '1'; };
  d.addEventListener('input', mark);
  d.addEventListener('change', mark);
}

// Дотик поза панеллю закриває її, лише якщо це справжній дотик (не прокручування) і почався він теж поза панеллю.
function enableBackdrop(d) {
  let down = null;
  // Коли закривається колесо вибору часу чи дати, iOS може передати останній дотик сторінці.
  // Такий дотик протягом 0,7 с після зміни поля — не команда закрити панель.
  let edited = -1e9;
  const touchEdit = () => { edited = performance.now(); };
  d.addEventListener('input', touchEdit, true);
  d.addEventListener('change', touchEdit, true);
  const outside = (e) => {
    const r = d.getBoundingClientRect();
    return e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right;
  };
  d.addEventListener('pointerdown', (e) => { down = e.target === d && outside(e) ? { x: e.clientX, y: e.clientY } : null; });
  d.addEventListener('click', (e) => {
    const start = down;
    down = null;
    if (e.target !== d || !start || !outside(e)) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) return;
    if (performance.now() - edited < 700) return;
    // Відкрита клавіатура: перший дотик лише ховає її.
    if (typing(d)) { document.activeElement.blur(); return; }
    if (guarded(d)) { nudge(d); return; }
    closeSheet();
  });
}

export function sheetHead(title, { done = 'Готово', cancel = '', submit = false } = {}) {
  return `<div class="sheet-head">
    ${cancel ? `<button type="button" class="link" data-act="sheetClose">${esc(cancel)}</button>` : '<span></span>'}
    <h2 class="sheet-title">${esc(title)}</h2>
    ${done ? `<button type="${submit ? 'submit' : 'button'}" class="link strong"${submit ? '' : ' data-act="sheetClose"'}>${esc(done)}</button>` : '<span></span>'}
  </div>`;
}

export function confirmSheet({ title, text = '', ok = 'Так', danger = false, cancel = 'Скасувати' }) {
  return new Promise((resolve) => {
    let answered = false;
    const d = openSheet(`
      <div class="confirm">
        <h2 class="sheet-title">${esc(title)}</h2>
        ${text ? `<p class="sheet-text">${esc(text)}</p>` : ''}
        <div class="stack">
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-block btn-lg" data-ok>${esc(ok)}</button>
          <button type="button" class="btn btn-quiet btn-block" data-no>${esc(cancel)}</button>
        </div>
      </div>`, { onClose: () => { if (!answered) resolve(false); }, label: title });
    d.querySelector('[data-ok]').addEventListener('click', () => { answered = true; resolve(true); closeSheet(); });
    d.querySelector('[data-no]').addEventListener('click', () => closeSheet());
  });
}

// Вибір одного варіанта: [{ id, label, icon, hint, danger }]
export function choiceSheet({ title, text = '', options }) {
  return new Promise((resolve) => {
    let answered = false;
    const d = openSheet(`
      <div class="choice">
        <h2 class="sheet-title">${esc(title)}</h2>
        ${text ? `<p class="sheet-text">${esc(text)}</p>` : ''}
        <div class="list choice-list">${options.map((o) => `
          <button type="button" class="row row-btn${o.danger ? ' danger' : ''}" data-choice="${esc(o.id)}">
            ${o.icon ? `<span class="row-ic">${icon(o.icon)}</span>` : ''}
            <span class="row-main"><span class="row-title">${esc(o.label)}</span>${o.hint ? `<span class="row-meta">${esc(o.hint)}</span>` : ''}</span>
          </button>`).join('')}</div>
        <button type="button" class="btn btn-quiet btn-block" data-no>Скасувати</button>
      </div>`, { onClose: () => { if (!answered) resolve(null); }, label: title });
    for (const b of d.querySelectorAll('[data-choice]')) {
      b.addEventListener('click', () => { answered = true; resolve(b.dataset.choice); closeSheet(); });
    }
    d.querySelector('[data-no]').addEventListener('click', () => closeSheet());
  });
}

/* ---------- Повноекранний режим (Фокус, перевірка, сценарій, підсумок) ---------- */

const AMBIENT = '<div class="ambient" aria-hidden="true"></div>';
// Фонове зображення екрана живе окремо від вмісту: оновлення вмісту його не перемальовує.
const bgLayer = (bg, pos) => (bg ? `<div class="scr-bg" aria-hidden="true"><img src="${esc(bg)}" alt="" decoding="async" style="object-position:${esc(pos)}"></div>` : '');
export function screenOpen() { return $('#screen').open; }

// from — елемент, з якого «виростає» екран (плитка, кнопка); анімація лише clip-path і opacity.
export function openScreen(html, { onClose = null, label = 'Екран', from = null, cls = '', bg = '', bgPos = 'center' } = {}) {
  const d = $('#screen');
  // Екран ще зникає після попереднього закриття — зупиняємо це, щоб не закрити новий.
  if (d._fade) { d._fade.onfinish = null; d._fade.cancel(); d._fade = null; }
  const wasOpen = d.open;
  d.className = `screen ${cls}${bg ? ' has-bg' : ''}`.trim();
  d.setAttribute('aria-label', label);
  const kept = rescueToast(d);
  d.innerHTML = bgLayer(bg, bgPos) + AMBIENT + html;
  d.classList.toggle('has-head', liftHead(d, '.scr > .scr-head'));
  d.onCloseOnce = onClose;
  if (kept) d.append($('#toast'));
  if (!wasOpen) {
    showModalTop(d);
    syncModalClass();
    adoptToast(d);
    if (from && !reduceMotion() && d.animate) {
      const r = from.getBoundingClientRect();
      const W = window.innerWidth, H = window.innerHeight;
      const rad = parseFloat(getComputedStyle(from).borderTopLeftRadius) || 24;
      const start = `inset(${r.top}px ${W - r.right}px ${H - r.bottom}px ${r.left}px round ${rad}px)`;
      d.animate([{ clipPath: start, opacity: 0.6 }, { clipPath: 'inset(0px 0px 0px 0px round 0px)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
      const inner = d.querySelector('.scr');
      inner?.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: 60, easing: 'ease-out', fill: 'backwards' });
    } else if (!reduceMotion()) {
      d.classList.add('rise');
      setTimeout(() => d.classList.remove('rise'), 320);
    }
    d.querySelector('[data-focus]')?.focus();
  }
  return d;
}

export function updateScreen(html, { top = null } = {}) {
  const d = $('#screen');
  if (!d.open) return;
  const sc = d.querySelector('.scr');
  const was = sc ? sc.scrollTop : 0;
  const ae = document.activeElement;
  const keep = ae && d.contains(ae) && ae.id ? ae.id : '';
  for (const el of [...d.children]) if (!el.classList.contains('scr-bg') && !el.classList.contains('ambient') && el.id !== 'toast') el.remove();
  d.insertAdjacentHTML('beforeend', html);
  d.classList.toggle('has-head', liftHead(d, '.scr > .scr-head'));
  const t = $('#toast');
  if (t && d.contains(t)) d.append(t); // повідомлення — завжди поверх вмісту
  const sc2 = d.querySelector('.scr');
  if (sc2) sc2.scrollTop = top ?? was;
  if (keep) document.getElementById(keep)?.focus({ preventScroll: true });
}

// Змінити фон відкритого екрана (наприклад, перевірка → результат).
export function setScreenBg(bg, pos = 'center') {
  const d = $('#screen');
  if (!d.open) return;
  d.querySelector('.scr-bg')?.remove();
  if (bg) d.insertAdjacentHTML('afterbegin', bgLayer(bg, pos));
  d.classList.toggle('has-bg', !!bg);
}

export function closeScreen() {
  const d = $('#screen');
  if (!d.open || d.classList.contains('closing')) return;
  d.classList.add('closing');
  homeToast(d);
  if (reduceMotion() || !d.animate) { d.close(); return; }
  const a = d.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.98)' }], { duration: 180, easing: 'ease-in' });
  d._fade = a;
  a.onfinish = () => { d._fade = null; if (d.open) d.close(); };
}

export function initDialogs() {
  for (const d of $$('dialog')) {
    d.addEventListener('close', () => {
      d.classList.remove('closing');
      homeToast(d);
      syncModalClass();
      const fn = d.onCloseOnce;
      d.onCloseOnce = null;
      if (fn) fn();
    });
    if (d.id === 'sheet') {
      enableBackdrop(d);
      enableDrag(d);
    }
    // Вміст прокручено під заголовок: заголовок отримує тло й тонку лінію, текст не накладається.
    d.addEventListener('scroll', (e) => {
      const t = e.target;
      if (t.classList?.contains('sheet-body') || t.classList?.contains('scr')) d.classList.toggle('scrolled', t.scrollTop > 2);
    }, true);
  }
}

/* ---------- Дрібні елементи керування ---------- */

/* ---------- Перетягування рядків за ручку ---------- */
// Натисніть «⋮⋮» і тягніть: рядок іде за пальцем, сусіди розступаються, біля країв список гортається,
// після відпускання рядок плавно стає на місце. На клавіатурі — стрілки на ручці.
// Рядок, що тягнеться, — копія поверх списку (останній у списку, тож малюється зверху), оригінал тримає місце до відпускання.
export function sortable(list, { item, handle = '.drag', onMove = () => {} } = {}) {
  if (!list || list.dataset.sortable) return;
  list.dataset.sortable = '1';
  const rows = () => [...list.children].filter((e) => e.matches(item) && !e.classList.contains('drag-ghost'));
  const scrollerOf = () => {
    for (let e = list.parentElement; e; e = e.parentElement) {
      const o = getComputedStyle(e).overflowY;
      if ((o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 1) return e;
    }
    return document.scrollingElement;
  };
  let s = null;
  const place = () => {
    const { all, from, sc, tops, hs, row } = s;
    const dyRaw = s.y - s.y0 + (sc.scrollTop - s.sc0);
    // Не далі країв списку.
    const top0 = tops[from] - tops[0];
    const room = tops[all.length - 1] + hs[all.length - 1] - tops[0] - hs[from];
    const dy = Math.max(-top0, Math.min(room - top0, dyRaw));
    s.ghost.style.transform = `translateY(${dy}px)`;
    const center = tops[from] + dy + hs[from] / 2;
    let to = from;
    for (let i = 0; i < all.length; i++) {
      if (i === from) continue;
      const mid = tops[i] + hs[i] / 2;
      // «≤» і «≥»: біля самого краю списку (рядок далі не їде) теж можна стати першим чи останнім.
      if (i < from && center <= mid) to = Math.min(to, i);
      if (i > from && center >= mid) to = Math.max(to, i);
    }
    if (to !== s.to) { s.to = to; haptic(); }
    const step = hs[from];
    all.forEach((r, i) => {
      if (r === row) return;
      const shift = from < i && i <= to ? -step : to <= i && i < from ? step : 0;
      r.style.transform = shift ? `translateY(${shift}px)` : '';
    });
  };
  const loop = () => {
    if (!s) return;
    // Біля верхнього чи нижнього краю видимої області — гортаємо.
    const r = s.sc === document.scrollingElement ? { top: 0, bottom: innerHeight } : s.sc.getBoundingClientRect();
    const vb = window.visualViewport ? visualViewport.offsetTop + visualViewport.height : innerHeight;
    const top = Math.max(r.top, 0) + 56, bottom = Math.min(r.bottom, vb) - 56;
    const v = s.y < top ? -Math.min(14, (top - s.y) / 3) : s.y > bottom ? Math.min(14, (s.y - bottom) / 3) : 0;
    if (v) s.sc.scrollTop += v;
    place();
    s.raf = requestAnimationFrame(loop);
  };
  const end = (keep) => {
    if (!s) return;
    const st = s;
    s = null;
    cancelAnimationFrame(st.raf);
    const { all, from, row, ghost, tops, hs } = st;
    const to = keep ? st.to : from;
    // Куди стає рядок: сума висот сусідів, які він минув.
    let slot = 0;
    if (to > from) for (let i = from + 1; i <= to; i++) slot += hs[i];
    else for (let i = to; i < from; i++) slot -= hs[i];
    const ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 170;
    ghost.style.transition = `transform ${ms}ms var(--ease)`;
    ghost.style.transform = `translateY(${slot}px)`;
    const done = () => {
      if (to !== from) list.insertBefore(row, to > from ? all[to].nextSibling : all[to]);
      for (const r of all) { r.style.transition = 'none'; r.style.transform = ''; }
      row.classList.remove('drag-ph');
      ghost.remove();
      list.classList.remove('sorting');
      requestAnimationFrame(() => { for (const r of all) r.style.transition = ''; });
      if (to !== from) { haptic(); onMove(from, to, row); }
    };
    if (ms) setTimeout(done, ms + 20); else done();
  };
  list.addEventListener('pointerdown', (e) => {
    const h = e.target.closest(handle);
    if (!h || !list.contains(h) || e.button > 0 || s) return;
    const row = h.closest(item);
    if (!row || !list.contains(row)) return;
    e.preventDefault();
    try { h.setPointerCapture(e.pointerId); } catch { /* немає захоплення — працюємо й так */ }
    const all = rows();
    const from = all.indexOf(row);
    const sc = scrollerOf();
    const lr = list.getBoundingClientRect();
    const rects = all.map((r) => r.getBoundingClientRect());
    const ghost = row.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.inert = true;
    ghost.setAttribute('aria-hidden', 'true');
    Object.assign(ghost.style, { position: 'absolute', left: `${rects[from].left - lr.left - list.clientLeft}px`, top: `${rects[from].top - lr.top - list.clientTop}px`, width: `${rects[from].width}px`, height: `${rects[from].height}px`, margin: '0' });
    list.append(ghost);
    row.classList.add('drag-ph');
    list.classList.add('sorting');
    s = { h, row, all, from, to: from, sc, ghost, y0: e.clientY, y: e.clientY, sc0: sc.scrollTop, tops: rects.map((r) => r.top + sc.scrollTop), hs: rects.map((r) => r.height), raf: 0 };
    haptic();
    loop();
  });
  list.addEventListener('pointermove', (e) => { if (s) { s.y = e.clientY; e.preventDefault(); } });
  list.addEventListener('pointerup', () => end(true));
  list.addEventListener('pointercancel', () => end(false));
  list.addEventListener('lostpointercapture', () => end(true));
  // Клавіатура: стрілки на ручці переставляють рядок на одну позицію.
  list.addEventListener('keydown', (e) => {
    const h = e.target.closest(handle);
    if (!h || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const row = h.closest(item);
    const all = rows();
    const from = all.indexOf(row);
    const to = from + (e.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= all.length) return;
    e.preventDefault();
    list.insertBefore(row, to > from ? all[to].nextSibling : all[to]);
    h.focus();
    onMove(from, to, row);
  });
}

// Текст кроку в редакторах — поле росте разом із текстом, тож довгий крок видно повністю.
// Enter не переносить рядок, а веде до наступного кроку; на останньому — додає новий.
export function growStep(el) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}
export function growSteps(root) {
  root?.querySelectorAll('textarea.step-t').forEach(growStep);
}
// Лише в браузері: тести логіки підключають ui.js і в Node, де немає document.
if (typeof document !== 'undefined') {
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.matches?.('textarea.step-t')) return;
    if (t.value.includes('\n')) t.value = t.value.replace(/\s*\n+\s*/g, ' ');
    growStep(t);
  });
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.key !== 'Enter' || e.isComposing || !t.matches?.('textarea.step-t')) return;
    e.preventDefault();
    const row = t.closest('.sc-step');
    const next = row?.nextElementSibling?.querySelector('textarea.step-t');
    if (next) { next.focus(); return; }
    if (!t.value.trim()) { t.blur(); return; }
    row?.closest('form')?.querySelector('[data-act="scAdd"], [data-act="ideaNewStep"]')?.click();
  });
  addEventListener('resize', () => growSteps(document.querySelector('#sheet')));
}

export function seg(name, options, value, act, field = '') {
  return `<div class="seg" role="radiogroup" aria-label="${esc(name)}"${field ? ` data-field="${field}"` : ''}>${options.map((o) => `
    <button type="button" role="radio" aria-checked="${String(o.id) === String(value)}" data-act="${act}" data-v="${esc(o.id)}">${o.icon ? icon(o.icon) : ''}<span>${esc(o.name)}</span></button>`).join('')}</div>`;
}

export function checkBtn({ act, id, on = false, tone = '', label = '', extra = '' }) {
  return `<button type="button" class="check${on ? ' on' : ''}" data-tone="${tone}" role="checkbox" aria-checked="${on}" aria-label="${esc(label)}" data-act="${act}" data-id="${esc(id)}"${extra}>${icon('check')}</button>`;
}

export function stepper(name, value, lo, hi, label, step = 1, unit = 'хв') {
  return `<div class="stepper">
    <button type="button" class="st-btn" data-act="numStep" data-d="-${step}" aria-label="Менше">−</button>
    <input class="st-input" type="number" inputmode="numeric" name="${name}" value="${value}" min="${lo}" max="${hi}" aria-label="${esc(label)}">
    ${unit ? `<span class="st-unit">${unit}</span>` : ''}
    <button type="button" class="st-btn" data-act="numStep" data-d="${step}" aria-label="Більше">+</button>
  </div>`;
}
