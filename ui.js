// ОПОРА 365 — помічники інтерфейсу: екранування, повідомлення, нижні панелі, повноекранні режими,
// тактильний відгук. Під час імпорту модуль не звертається до DOM (його використовують і тести в Node).
import { icon } from './icons.js';

export { icon };
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

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
export function toast(message, action = null, ms = 0) {
  const el = $('#toast');
  if (!el) return;
  el.innerHTML = `<span class="toast-text">${esc(message)}</span>${action ? `<button type="button" class="toast-btn">${esc(action.label)}</button>` : ''}`;
  const hide = () => el.classList.remove('show');
  if (action) el.querySelector('.toast-btn').addEventListener('click', () => { hide(); action.run(); }, { once: true });
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(toastTimer);
  if (ms !== Infinity) toastTimer = setTimeout(hide, ms || (action ? 5000 : 2600));
}

/* ---------- Нижня панель (BottomSheet) ---------- */

function syncModalClass() {
  const any = $$('dialog').some((d) => d.open);
  document.documentElement.classList.toggle('modal-open', any);
}

export function openSheet(html, { onClose = null, label = 'Панель' } = {}) {
  const d = $('#sheet');
  d.classList.remove('closing');
  d.style.transform = '';
  d.setAttribute('aria-label', label);
  d.innerHTML = `<div class="sheet-grab" aria-hidden="true"><span></span></div><div class="sheet-body" tabindex="-1">${html}</div>`;
  d.onCloseOnce = onClose;
  if (!d.open) d.showModal();
  syncModalClass();
  const f = d.querySelector('[data-focus]');
  if (f) f.focus();
  else d.querySelector('.sheet-body').focus({ preventScroll: true });
  return d;
}

export function closeSheet() {
  const d = $('#sheet');
  if (!d.open) return;
  if (reduceMotion()) { d.close(); return; }
  d.classList.add('closing');
  setTimeout(() => { d.classList.remove('closing'); d.style.transform = ''; if (d.open) d.close(); }, 200);
}

// Потягнути панель донизу, щоб закрити.
function enableDrag(d) {
  let y0 = 0, dy = 0, t0 = 0, active = false;
  d.addEventListener('touchstart', (e) => {
    const body = d.querySelector('.sheet-body');
    const onGrab = e.target.closest('.sheet-grab, .sheet-head');
    if (!onGrab && body && body.scrollTop > 0) return;
    if (e.target.closest('input, textarea, select, .seg, .stepper')) return;
    active = true; y0 = e.touches[0].clientY; dy = 0; t0 = Date.now();
  }, { passive: true });
  d.addEventListener('touchmove', (e) => {
    if (!active) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    if (dy > 4) { d.classList.add('dragging'); d.style.transform = `translateY(${dy}px)`; }
  }, { passive: true });
  const end = () => {
    if (!active) return;
    active = false;
    d.classList.remove('dragging');
    const fast = dy > 40 && dy / Math.max(1, Date.now() - t0) > 0.6;
    if (dy > 110 || fast) closeSheet();
    else d.style.transform = '';
  };
  d.addEventListener('touchend', end);
  d.addEventListener('touchcancel', end);
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

/* ---------- Повноекранний режим (Фокус, перевірка, сценарій) ---------- */

const AMBIENT = '<div class="ambient" aria-hidden="true"></div>';
export function screenOpen() { return $('#screen').open; }

// from — елемент, з якого «виростає» екран (плитка, кнопка); анімація лише clip-path і opacity.
export function openScreen(html, { onClose = null, label = 'Екран', from = null, cls = '' } = {}) {
  const d = $('#screen');
  const wasOpen = d.open;
  d.className = `screen ${cls}`.trim();
  d.setAttribute('aria-label', label);
  d.innerHTML = AMBIENT + html;
  d.onCloseOnce = onClose;
  if (!wasOpen) {
    d.showModal();
    syncModalClass();
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

export function updateScreen(html) {
  const d = $('#screen');
  if (!d.open) return;
  const sc = d.querySelector('.scr');
  const top = sc ? sc.scrollTop : 0;
  const ae = document.activeElement;
  const keep = ae && d.contains(ae) && ae.id ? ae.id : '';
  d.innerHTML = AMBIENT + html;
  const sc2 = d.querySelector('.scr');
  if (sc2) sc2.scrollTop = top;
  if (keep) document.getElementById(keep)?.focus({ preventScroll: true });
}

export function closeScreen() {
  const d = $('#screen');
  if (!d.open) return;
  if (reduceMotion() || !d.animate) { d.close(); return; }
  const a = d.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.98)' }], { duration: 180, easing: 'ease-in' });
  a.onfinish = () => { if (d.open) d.close(); };
}

export function initDialogs() {
  for (const d of $$('dialog')) {
    d.addEventListener('close', () => {
      syncModalClass();
      const fn = d.onCloseOnce;
      d.onCloseOnce = null;
      if (fn) fn();
    });
    if (d.id === 'sheet') {
      d.addEventListener('click', (e) => { if (e.target === d) closeSheet(); });
      enableDrag(d);
    }
  }
}

/* ---------- Дрібні елементи керування ---------- */

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
