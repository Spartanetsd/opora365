// ОПОРА · Мій день — чиста логіка без DOM.
// Цей модуль використовують і застосунок (app.js), і тести (tests.js).

export const SCHEMA = 1;
export const DAY = 1440;   // хвилин у добі
export const GRACE = 120;  // скільки хвилин після часу виходу план ще вважається «сьогоднішнім»

export const PRIORITIES = [
  { id: 1, name: 'Обов’язково сьогодні', short: 'Обов’язково', tone: 'red' },
  { id: 2, name: 'Важливо', short: 'Важливо', tone: 'orange' },
  { id: 3, name: 'Можна пізніше', short: 'Пізніше', tone: 'gray' },
];
export const TRANSPORT = [
  { id: 'bus', name: 'Автобус' },
  { id: 'car', name: 'Авто' },
  { id: 'taxi', name: 'Таксі' },
  { id: 'walk', name: 'Пішки' },
];
export const BUFFERS = [10, 15, 20];

/* ---------- Час і дати (Europe/Kyiv) ---------- */

export function parseHM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s ?? '').trim());
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  return h > 23 || mi > 59 ? null : h * 60 + mi;
}

export function fmtHM(min) {
  const v = ((Math.round(min) % DAY) + DAY) % DAY;
  return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
}

export function fmtDur(min) {
  const t = Math.max(0, Math.round(min));
  const h = Math.floor(t / 60), m = t % 60;
  if (!h) return `${m} хв`;
  return m ? `${h} год ${m} хв` : `${h} год`;
}

function makeFmt(place) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: place, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
}
let area = 'Europe/Kyiv';
let FMT;
try { FMT = makeFmt(area); } catch {
  try { area = 'Europe/Kiev'; FMT = makeFmt(area); } catch { area = ''; FMT = makeFmt(undefined); }
}
export const TIME_AREA = area || 'local';

export function kyivParts(ms = Date.now()) {
  const p = {};
  for (const part of FMT.formatToParts(new Date(ms))) p[part.type] = part.value;
  return { date: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute, sec: +p.second };
}
export const todayKey = (ms = Date.now()) => kyivParts(ms).date;

export function dayNum(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 864e5);
}
export function dateFromNum(n) {
  const d = new Date(n * 864e5);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
export const addDays = (key, n) => dateFromNum(dayNum(key) + n);
export const diffDays = (from, to) => dayNum(to) - dayNum(from);

// «Місцеві хвилини»: номер дня × 1440 + хвилина доби за київським часом.
export function localMin(ms = Date.now()) {
  const p = kyivParts(ms);
  return dayNum(p.date) * DAY + p.min + p.sec / 60;
}

const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const MONTHS_S = ['січ.', 'лют.', 'бер.', 'квіт.', 'трав.', 'черв.', 'лип.', 'серп.', 'вер.', 'жовт.', 'лист.', 'груд.'];
const WEEKDAYS = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота'];
const WD_S = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export const weekday = (key) => (((dayNum(key) + 4) % 7) + 7) % 7; // 0 — неділя
export function longDate(key) {
  const [, m, d] = key.split('-').map(Number);
  return `${WEEKDAYS[weekday(key)]}, ${d} ${MONTHS[m - 1]}`;
}
export function shortDate(key, today) {
  const diff = diffDays(today, key);
  if (diff === 0) return 'сьогодні';
  if (diff === 1) return 'завтра';
  if (diff === -1) return 'учора';
  const [, m, d] = key.split('-').map(Number);
  return `${WD_S[weekday(key)]}, ${d} ${MONTHS_S[m - 1]}`;
}
export function plural(n, [one, few, many]) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  return b >= 2 && b <= 4 ? few : many;
}
export const daysWord = (n) => `${n} ${plural(n, ['день', 'дні', 'днів'])}`;

/* ---------- Стан за замовчуванням ---------- */

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function mkStep(title, min, short, extra = {}) {
  return { id: uid(), title, min, short, critical: false, items: [], kind: '', ...extra };
}
export function defaultSteps() {
  return [
    mkStep('Прокинутися', 5, 2),
    mkStep('Гігієна', 15, 7),
    mkStep('Сніданок і вода', 15, 3),
    mkStep('Особисті речі', 10, 5),
    mkStep('Документи, телефон, заряд', 5, 5, { critical: true, items: ['Документи', 'Телефон заряджений', 'Павербанк і кабель', 'Ключі'] }),
    mkStep('Перевірка завдань', 5, 1, { kind: 'tasks' }),
    mkStep('Одягнутися й вийти', 5, 5),
  ];
}
export function defaultState() {
  return {
    v: SCHEMA,
    updatedAt: 0,
    settings: { theme: 'auto', lastBackupAt: 0, installHint: true },
    morning: { arrival: '08:30', transport: 'bus', travel: { bus: 40, car: 25, taxi: 20, walk: 35 }, buffer: 15, steps: defaultSteps() },
    session: null,
    tasks: [],
    musts: [],
  };
}

/* ---------- Ранковий план ---------- */

export const travelOf = (m) => m.travel[m.transport] ?? 0;
export const effDur = (s, short) => (short && !s.critical ? s.short : s.min);

// Вихід = прибуття − дорога − запас; підйом = вихід − сума кроків.
export function computePlan(m, short = false) {
  const arrival = parseHM(m.arrival) ?? 510;
  const travel = travelOf(m);
  const departure = arrival - travel - m.buffer;
  let t = departure - m.steps.reduce((sum, s) => sum + effDur(s, short), 0);
  const wake = t;
  const steps = m.steps.map((s) => {
    const dur = effDur(s, short);
    const row = { ...s, dur, start: t };
    t += dur;
    return row;
  });
  return { arrival, travel, buffer: m.buffer, departure, wake, total: departure - wake, steps, wakePrevDay: wake < 0 };
}

// На який ранок діє план: сьогодні, доки не минуло GRACE хв після виходу, інакше — завтра.
export function planTarget(m, nowLocal) {
  const dep = computePlan(m).departure;
  const n = Math.floor(nowLocal / DAY);
  return dateFromNum(n * DAY + dep + GRACE >= nowLocal ? n : n + 1);
}

export function newSession(m, nowMs) {
  return { date: planTarget(m, localMin(nowMs)), startedAt: nowMs, done: {}, skipped: {}, checks: {}, short: false, finishedAt: 0 };
}

export function activeSession(state, nowLocal) {
  const s = state.session;
  if (!s) return null;
  return dayNum(s.date) * DAY + computePlan(state.morning).departure + GRACE >= nowLocal ? s : null;
}

function walk(state, session, short, now) {
  const plan = computePlan(state.morning, short);
  const lastMs = Math.max(session.startedAt, ...Object.values(session.done).map(Number));
  const elapsed = now - localMin(lastMs);
  const rows = [];
  let cursor = now, remaining = 0, current = null;
  for (const s of plan.steps) {
    const st = session.done[s.id] ? 'done' : session.skipped[s.id] ? 'skipped' : s.dur === 0 ? 'auto' : 'todo';
    let left = 0;
    const first = st === 'todo' && !current;
    if (st === 'todo') left = first && elapsed >= 0 && elapsed <= 90 ? Math.max(1, s.dur - elapsed) : s.dur;
    const row = { ...s, state: st, eta: st === 'todo' ? cursor : null, left, doneAt: Number(session.done[s.id]) || 0 };
    if (first) current = row;
    rows.push(row);
    cursor += left;
    remaining += left;
  }
  return { plan, rows, remaining, current };
}

// Стан ранкової підготовки на момент nowMs.
export function sessionStatus(state, session, nowMs) {
  const now = localMin(nowMs);
  const short = !!session.short;
  const main = walk(state, session, short, now);
  const alt = walk(state, session, true, now);
  const depAt = dayNum(session.date) * DAY + main.plan.departure;
  const toDep = depAt - now;
  const spare = toDep - main.remaining;
  const altSpare = toDep - alt.remaining;
  let level = 'ok';
  if (spare < 0) level = !short && altSpare >= 0 ? 'tight' : 'late';
  const counted = main.rows.filter((r) => r.state !== 'auto');
  return {
    ...main, depAt, toDep, spare, altSpare, level, short,
    expected: now + main.remaining,
    finished: !main.current,
    doneCount: counted.filter((r) => r.state === 'done' || r.state === 'skipped').length,
    count: counted.length,
  };
}

// Короткий підсумок для картки «Сьогодні».
export function morningSummary(state, nowMs) {
  const now = localMin(nowMs);
  const plan = computePlan(state.morning);
  const session = activeSession(state, now);
  const date = session ? session.date : planTarget(state.morning, now);
  const base = dayNum(date) * DAY;
  const wakeAt = base + plan.wake, depAt = base + plan.departure;
  let phase = 'before';
  if (session) phase = session.finishedAt ? 'finished' : 'running';
  else if (now >= depAt) phase = 'after';
  else if (now >= wakeAt) phase = 'window';
  return { plan, date, rel: dayNum(date) - Math.floor(now / DAY), wakeAt, depAt, now, phase, session, toWake: wakeAt - now, toDep: depAt - now };
}

export function moveItem(list, id, dir) {
  const i = list.findIndex((x) => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const copy = list.slice();
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

/* ---------- Справи на сьогодні ---------- */

export const normTitle = (s) => String(s).toLowerCase().replace(/[’'ʼ`"«».,!?;:()\-–—]/g, ' ').replace(/\s+/g, ' ').trim();

export function findDuplicate(list, title, exceptId = '') {
  const n = normTitle(title);
  return n ? list.find((t) => !t.doneAt && t.id !== exceptId && normTitle(t.title) === n) || null : null;
}

export function newTask(title, pr, due, nowMs = Date.now()) {
  return { id: uid(), title: String(title).trim().slice(0, 300), pr, due, note: '', createdAt: nowMs, doneAt: 0, moved: 0 };
}

// Перенесення на наступний день: та сама справа, без копії.
export function postpone(task, today) {
  const base = task.due > today ? task.due : today;
  return { ...task, due: addDays(base, 1), moved: (task.moved || 0) + 1 };
}

const cmpKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const byTask = (a, b) => a.pr - b.pr || cmpKey(a.due, b.due) || a.createdAt - b.createdAt;

export function taskView(tasks, today) {
  const open = tasks.filter((t) => !t.doneAt);
  const overdue = open.filter((t) => t.due < today).sort(byTask);
  const todays = open.filter((t) => t.due === today).sort(byTask);
  const upcoming = open.filter((t) => t.due > today).sort((a, b) => cmpKey(a.due, b.due) || a.pr - b.pr || a.createdAt - b.createdAt);
  const doneToday = tasks.filter((t) => t.doneAt && todayKey(t.doneAt) === today).sort((a, b) => b.doneAt - a.doneAt);
  return {
    overdue, today: todays, upcoming, doneToday,
    focus: [...overdue, ...todays].sort(byTask).slice(0, 3),
    groups: PRIORITIES.map((p) => ({ ...p, items: todays.filter((t) => t.pr === p.id) })),
    openCount: overdue.length + todays.length,
  };
}

/* ---------- Обов’язкові справи (не зникають до виконання) ---------- */

export function newMust(title, deadline = '', nowMs = Date.now()) {
  return { id: uid(), title: String(title).trim().slice(0, 300), note: '', deadline, createdAt: nowMs, doneAt: 0 };
}

export function mustView(musts, today) {
  const open = musts
    .filter((m) => !m.doneAt)
    .map((m) => ({ ...m, age: Math.max(0, diffDays(todayKey(m.createdAt), today)), left: m.deadline ? diffDays(today, m.deadline) : null }))
    .sort((a, b) => (a.left ?? 1e9) - (b.left ?? 1e9) || a.createdAt - b.createdAt);
  const done = musts.filter((m) => m.doneAt).sort((a, b) => b.doneAt - a.doneAt);
  return { open, done };
}

// Виконане старше 30 днів прибираємо, щоб сховище не росло.
export function purge(state, nowMs = Date.now()) {
  const cut = nowMs - 30 * 864e5;
  state.tasks = state.tasks.filter((t) => !t.doneAt || t.doneAt > cut);
  state.musts = state.musts.filter((m) => !m.doneAt || m.doneAt > cut);
  return state;
}

/* ---------- Перевірка даних, міграції, резервні копії ---------- */

const isKey = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const str = (s, max) => (typeof s === 'string' ? s.slice(0, max) : '');
const int = (v, lo, hi, d) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const stamp = (v) => (Number.isFinite(+v) && +v > 0 ? +v : 0);
const plain = (o) => o && typeof o === 'object' && !Array.isArray(o);
const cleanId = (v) => (typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : uid());

// Приводить будь-які збережені або імпортовані дані до коректної схеми.
export function cleanState(raw, nowMs = Date.now()) {
  const d = defaultState();
  if (!plain(raw)) return { state: d, dropped: 0 };
  let dropped = 0;
  const today = todayKey(nowMs);

  const st = plain(raw.settings) ? raw.settings : {};
  const settings = {
    theme: ['auto', 'light', 'dark'].includes(st.theme) ? st.theme : 'auto',
    lastBackupAt: stamp(st.lastBackupAt),
    installHint: st.installHint !== false,
  };

  const rm = plain(raw.morning) ? raw.morning : {};
  const arr = parseHM(rm.arrival);
  const travel = {};
  for (const t of TRANSPORT) travel[t.id] = int(rm.travel?.[t.id], 0, 600, d.morning.travel[t.id]);
  let steps = d.morning.steps;
  if (Array.isArray(rm.steps)) {
    const ids = new Set();
    steps = [];
    for (const s of rm.steps) {
      const title = plain(s) ? str(s.title, 80).trim() : '';
      if (!title) { dropped++; continue; }
      const min = int(s.min, 1, 180, 5);
      const critical = s.critical === true;
      let id = cleanId(s.id);
      if (ids.has(id)) id = uid();
      ids.add(id);
      steps.push({
        id, title, min, critical,
        short: critical ? min : int(s.short, 0, min, min),
        items: Array.isArray(s.items) ? s.items.map((x) => str(x, 60).trim()).filter(Boolean).slice(0, 12) : [],
        kind: s.kind === 'tasks' ? 'tasks' : '',
      });
    }
  }
  const morning = {
    arrival: arr == null ? d.morning.arrival : fmtHM(arr),
    transport: TRANSPORT.some((t) => t.id === rm.transport) ? rm.transport : 'bus',
    travel,
    buffer: BUFFERS.includes(+rm.buffer) ? +rm.buffer : 15,
    steps,
  };

  let session = null;
  const rs = raw.session;
  if (plain(rs) && isKey(rs.date) && stamp(rs.startedAt)) {
    const done = {}, skipped = {}, checks = {};
    if (plain(rs.done)) for (const [k, v] of Object.entries(rs.done)) if (stamp(v)) done[k] = stamp(v);
    if (plain(rs.skipped)) for (const [k, v] of Object.entries(rs.skipped)) if (v === true) skipped[k] = true;
    if (plain(rs.checks)) for (const [k, v] of Object.entries(rs.checks)) if (Array.isArray(v)) checks[k] = v.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < 12);
    session = { date: rs.date, startedAt: stamp(rs.startedAt), done, skipped, checks, short: rs.short === true, finishedAt: stamp(rs.finishedAt) };
  }

  const seen = new Set();
  const take = (x) => {
    const title = plain(x) ? str(x.title, 300).trim() : '';
    if (!title) { dropped++; return null; }
    let id = cleanId(x.id);
    if (seen.has(id)) id = uid();
    seen.add(id);
    return { id, title, note: str(x.note, 2000), createdAt: stamp(x.createdAt) || nowMs, doneAt: stamp(x.doneAt) };
  };
  const tasks = [];
  for (const x of Array.isArray(raw.tasks) ? raw.tasks : []) {
    const b = take(x);
    if (b) tasks.push({ ...b, pr: int(x.pr, 1, 3, 2), due: isKey(x.due) ? x.due : today, moved: int(x.moved, 0, 999, 0) });
  }
  const musts = [];
  for (const x of Array.isArray(raw.musts) ? raw.musts : []) {
    const b = take(x);
    if (b) musts.push({ ...b, deadline: isKey(x.deadline) ? x.deadline : '' });
  }

  return { state: { v: SCHEMA, updatedAt: stamp(raw.updatedAt), settings, morning, session, tasks, musts }, dropped };
}

export function overview(s) {
  return {
    tasks: s.tasks.filter((t) => !t.doneAt).length,
    tasksDone: s.tasks.filter((t) => t.doneAt).length,
    musts: s.musts.filter((m) => !m.doneAt).length,
    steps: s.morning.steps.length,
    arrival: s.morning.arrival,
  };
}

export function makeBackup(state, nowMs = Date.now()) {
  return { app: 'opora', kind: 'backup', v: SCHEMA, exportedAt: nowMs, data: { ...state, session: null } };
}

export function readBackup(obj) {
  if (!plain(obj)) return { ok: false, error: 'Файл не схожий на резервну копію ОПОРА.' };
  if (obj.app !== 'opora' || obj.kind !== 'backup' || !plain(obj.data)) return { ok: false, error: 'Це не резервна копія ОПОРА.' };
  if (!(+obj.v >= 1)) return { ok: false, error: 'Невідома версія резервної копії.' };
  if (+obj.v > SCHEMA) return { ok: false, error: 'Копію створено новішою версією застосунку. Спершу оновіть застосунок.' };
  const { state, dropped } = cleanState(obj.data);
  return { ok: true, state, dropped, exportedAt: stamp(obj.exportedAt), summary: overview(state) };
}
