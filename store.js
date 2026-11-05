// ОПОРА 365 — локальне збереження на пристрої.
// Основне сховище — IndexedDB; синхронна копія в localStorage гарантує, що зміна
// не загубиться, навіть якщо застосунок закрили одразу після дії.
// Нічого не передається в мережу і не потрапляє в кеш Service Worker.
import { cleanState, SCHEMA } from './logic.js';

const DB_NAME = 'opora';
const STORE = 'kv';
const KEY = 'state';
// Копія даних до оновлення схеми: «state-before-v3» (і старіша «state-before-v2», якщо була).
const KEY_PREV = `state-before-v${SCHEMA}`;
const KEY_PREV_OLD = 'state-before-v2';
const LS_KEY = 'opora.state';
const LS_BEFORE_IMPORT = 'opora.before-import';

export const status = { idb: null, ls: null, migratedFrom: 0, hasPrev: false };

let dbp = null;
function openDB() {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('IndexedDB недоступна'));
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); dbp = null; };
        resolve(db);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB заблокована'));
    });
    dbp.catch(() => { dbp = null; });
  }
  return dbp;
}

function tx(mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

// Завантаження з безпечною міграцією: дані старої схеми спершу зберігаються як є.
export async function load(nowMs = Date.now()) {
  let a = null, b = null;
  try { a = await tx('readonly', (s) => s.get(KEY)); status.idb = true; } catch { status.idb = false; }
  try { b = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); status.ls = true; } catch { status.ls = false; }
  const candidates = [a, b].filter((x) => x && typeof x === 'object');
  candidates.sort((x, y) => (Number(y.updatedAt) || 0) - (Number(x.updatedAt) || 0));
  const raw = candidates[0] || null;
  if (raw && Number(raw.v) < SCHEMA) {
    status.migratedFrom = Number(raw.v) || 1;
    // Перед міграцією дані зберігаються як є — до них можна повернутися з налаштувань.
    const copy = { savedAt: nowMs, from: status.migratedFrom, data: raw };
    try {
      const kept = await tx('readonly', (s) => s.get(KEY_PREV));
      if (!kept) await tx('readwrite', (s) => s.put(copy, KEY_PREV));
    } catch { if (!lsGet(`opora.${KEY_PREV}`)) lsSet(`opora.${KEY_PREV}`, copy); }
  }
  status.hasPrev = !!(await previousData());
  return { state: cleanState(raw, nowMs).state, fresh: !raw };
}

// Копія даних, якими користувався застосунок до останнього оновлення схеми (якщо була).
export async function previousData() {
  for (const key of [KEY_PREV, KEY_PREV_OLD]) {
    try {
      const v = await tx('readonly', (s) => s.get(key));
      if (v) return v;
    } catch { /* немає доступу */ }
    const l = lsGet(`opora.${key}`);
    if (l) return l;
  }
  return null;
}

let timer = 0;
let pending = null;

export function save(state) {
  state.updatedAt = Date.now();
  pending = state;
  status.ls = lsSet(LS_KEY, state);
  clearTimeout(timer);
  timer = setTimeout(flush, 250);
}

export async function flush() {
  clearTimeout(timer);
  if (!pending) return;
  const value = pending;
  pending = null;
  try { await tx('readwrite', (s) => s.put(value, KEY)); status.idb = true; } catch { status.idb = false; }
}

export async function wipe() {
  pending = null;
  clearTimeout(timer);
  try { localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_BEFORE_IMPORT); } catch { /* немає доступу */ }
  try { await tx('readwrite', (s) => s.delete(KEY)); } catch { /* немає доступу */ }
}

export function keepBeforeImport(state) { return lsSet(LS_BEFORE_IMPORT, state); }
export function takeBeforeImport() {
  const raw = lsGet(LS_BEFORE_IMPORT);
  try { localStorage.removeItem(LS_BEFORE_IMPORT); } catch { /* немає доступу */ }
  return raw ? cleanState(raw).state : null;
}

// Постійне сховище: браузер не очищатиме дані автоматично (якщо дозволить).
export async function persistence(ask = false) {
  const s = navigator.storage;
  if (!s?.persisted) return null;
  try {
    if (ask && !(await s.persisted()) && s.persist) await s.persist();
    return await s.persisted();
  } catch { return null; }
}

// Зберегти файл: на iPhone — через меню «Поділитися» (→ «Зберегти у Файли»).
// Викликати синхронно з обробника натискання, інакше iOS не відкриє меню.
export async function shareFile(name, text) {
  const file = new File([text], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}

export function pickFile() {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'application/json,.json' });
    input.addEventListener('change', () => resolve(input.files?.[0] || null), { once: true });
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });
}

export async function readJSON(file) {
  if (file.size > 5 * 1024 * 1024) throw new Error('Файл завеликий для резервної копії.');
  return JSON.parse(await file.text());
}
