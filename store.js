// ОПОРА — локальне збереження на пристрої.
// Основне сховище — IndexedDB; синхронна копія в localStorage гарантує, що зміна
// не загубиться, навіть якщо застосунок закрили одразу після дії.
// Нічого не передається в мережу і не потрапляє в кеш Service Worker.
import { cleanState } from './logic.js';

const DB_NAME = 'opora';
const STORE = 'kv';
const KEY = 'state';
const LS_KEY = 'opora.state';
const LS_BEFORE_IMPORT = 'opora.before-import';

export const status = { idb: null, ls: null };

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

export async function load() {
  let a = null, b = null;
  try { a = await tx('readonly', (s) => s.get(KEY)); status.idb = true; } catch { status.idb = false; }
  try { b = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); status.ls = true; } catch { status.ls = false; }
  const candidates = [a, b].filter((x) => x && typeof x === 'object');
  candidates.sort((x, y) => (Number(y.updatedAt) || 0) - (Number(x.updatedAt) || 0));
  const raw = candidates[0] || null;
  return { state: cleanState(raw).state, fresh: !raw };
}

let timer = 0;
let pending = null;

export function save(state) {
  state.updatedAt = Date.now();
  pending = state;
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); status.ls = true; } catch { status.ls = false; }
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

export function keepBeforeImport(state) {
  try { localStorage.setItem(LS_BEFORE_IMPORT, JSON.stringify(state)); return true; } catch { return false; }
}
export function takeBeforeImport() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_BEFORE_IMPORT) || 'null');
    localStorage.removeItem(LS_BEFORE_IMPORT);
    return raw ? cleanState(raw).state : null;
  } catch { return null; }
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
