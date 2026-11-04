// ОПОРА — дрібні помічники інтерфейсу: екранування, іконки, повідомлення, нижні панелі.

export const $ = (sel, root = document) => root.querySelector(sel);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

// Лінійні іконки 24×24 (власний набір у стилі Lucide, без зовнішніх файлів).
const PATHS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  sunrise: '<path d="M12 2v8M4.93 10.93l1.41 1.41M2 18h2M20 18h2M19.07 10.93l-1.41 1.41M22 22H2M8 6l4-4 4 4M16 18a4 4 0 0 0-8 0"/>',
  list: '<path d="M3 17l2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8"/>',
  pin: '<path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1V10.76"/>',
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2"/><circle cx="12" cy="12" r="3"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  chev: '<path d="M9 18l6-6-6-6"/>',
  up: '<path d="M18 15l-6-6-6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1V13"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  alert: '<path d="M21.73 18l-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01"/>',
  trash: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  skip: '<path d="M6 17l5-5-5-5M13 17l5-5-5-5"/>',
  reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>',
  import: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  filecheck: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6M14 2v6h6M9 15l2 2 4-4"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  bus: '<path d="M8 6v6M15 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3M9 18h5"/><circle cx="7" cy="18" r="2"/><circle cx="16" cy="18" r="2"/>',
  car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2M9 17h6"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  taxi: '<path d="M10 2h4M21 8l-2 2-1.5-3.7A2 2 0 0 0 15.65 5H8.4a2 2 0 0 0-1.9 1.26L5 10 3 8M7 14h.01M17 14h.01M5 18v2M19 18v2"/><rect width="18" height="8" x="3" y="10" rx="2"/>',
  walk: '<circle cx="12" cy="5" r="1"/><path d="M9 20l3-6 3 6M6 8l6 2 6-2M12 10v4"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  phone: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
};

export const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${PATHS[name] || ''}</svg>`;

/* ---------- Коротке повідомлення внизу екрана ---------- */

let toastTimer = 0;
export function toast(message, action = null, ms = 0) {
  const el = $('#toast');
  if (!el) return;
  el.innerHTML = `<span class="toast-text">${esc(message)}</span>${action ? `<button type="button" class="toast-btn">${esc(action.label)}</button>` : ''}`;
  const hide = () => el.classList.remove('show');
  if (action) {
    el.querySelector('.toast-btn').addEventListener('click', () => { hide(); action.run(); }, { once: true });
  }
  el.classList.add('show');
  clearTimeout(toastTimer);
  if (ms !== Infinity) toastTimer = setTimeout(hide, ms || (action ? 5000 : 2600));
}

/* ---------- Нижня панель (sheet) ---------- */

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function syncModalClass() {
  const any = [...document.querySelectorAll('dialog')].some((d) => d.open);
  document.documentElement.classList.toggle('modal-open', any);
}

export function openSheet(html, { onClose = null, wide = false } = {}) {
  const d = $('#sheet');
  d.classList.remove('closing');
  d.classList.toggle('wide', wide);
  d.innerHTML = `<div class="sheet-body">${html}</div>`;
  d.onCloseOnce = onClose;
  if (!d.open) d.showModal();
  syncModalClass();
  const f = d.querySelector('[data-focus]');
  if (f) f.focus();
  else d.querySelector('.sheet-body').focus?.();
  return d;
}

export function closeSheet() {
  const d = $('#sheet');
  if (!d.open) return;
  if (reduceMotion()) { d.close(); return; }
  d.classList.add('closing');
  setTimeout(() => { d.classList.remove('closing'); if (d.open) d.close(); }, 170);
}

export function initDialogs() {
  for (const d of document.querySelectorAll('dialog')) {
    d.addEventListener('close', () => {
      syncModalClass();
      const fn = d.onCloseOnce;
      d.onCloseOnce = null;
      if (fn) fn();
    });
    // натискання на затемнений фон закриває панель
    d.addEventListener('click', (e) => { if (e.target === d && d.id === 'sheet') closeSheet(); });
  }
}

export function sheetHead(title, { done = 'Готово', cancel = '' } = {}) {
  return `<div class="sheet-head">
    ${cancel ? `<button type="button" class="link" data-act="sheetClose">${esc(cancel)}</button>` : '<span></span>'}
    <h2 class="sheet-title">${esc(title)}</h2>
    ${done ? `<button type="button" class="link strong" data-act="sheetClose">${esc(done)}</button>` : '<span></span>'}
  </div>`;
}

export function confirmSheet({ title, text = '', ok = 'Так', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const d = openSheet(`
      <div class="confirm">
        <h2 class="sheet-title">${esc(title)}</h2>
        ${text ? `<p class="sheet-text">${esc(text)}</p>` : ''}
        <div class="stack">
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-block" data-ok>${esc(ok)}</button>
          <button type="button" class="btn btn-plain btn-block" data-no>Скасувати</button>
        </div>
      </div>`, { onClose: () => { if (!answered) resolve(false); } });
    d.querySelector('[data-ok]').addEventListener('click', () => { answered = true; resolve(true); closeSheet(); });
    d.querySelector('[data-no]').addEventListener('click', () => closeSheet());
  });
}

// Сегментований перемикач.
export function seg(name, options, value, act, field = '') {
  return `<div class="seg" role="radiogroup" aria-label="${esc(name)}"${field ? ` data-field="${field}"` : ''}>${options.map((o) => `
    <button type="button" role="radio" aria-checked="${String(o.id) === String(value)}" data-act="${act}" data-v="${esc(o.id)}">${o.icon ? icon(o.icon) : ''}<span>${esc(o.name)}</span></button>`).join('')}</div>`;
}

// Відмітка-кружечок для справ і кроків.
export function checkBtn({ act, id, on = false, tone = '', label = '' }) {
  return `<button type="button" class="check${on ? ' on' : ''}" data-tone="${tone}" role="checkbox" aria-checked="${on}" aria-label="${esc(label)}" data-act="${act}" data-id="${esc(id)}">${icon('check')}</button>`;
}
