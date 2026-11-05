// ОПОРА 365 — основна логіка без DOM: ранок, справи, «Не забути», режими, наступна дія,
// пульс дня, вечірній підсумок, дані. Модуль використовують і застосунок, і тести (tests.js).
import {
  DAY, parseHM, fmtHM, fmtDur, todayKey, dayNum, dateFromNum, addDays, diffDays, isKey,
  localMin, minOfDay, keyOfLocal, localAt, weekday, shortDate, plural, count, daysWord, relIn, uid, WD_S,
} from './time.js';
import { defaultGear, cleanGear, gearSummary } from './logic-gear.js';
import { defaultDeck, cleanDeck, defaultTools, cleanTools, runProgress } from './logic-deck.js';

export * from './time.js';

export const SCHEMA = 3;
export const GRACE = 120; // скільки хвилин після виходу план ще вважається «сьогоднішнім»
export const ARCHIVE_DAYS = 180;
export const ARCHIVE_MAX = 1500;

export const PRIORITIES = [
  { id: 1, name: 'Обовʼязково сьогодні', short: 'Обовʼязково', tone: 'amber' },
  { id: 2, name: 'Важливо', short: 'Важливо', tone: 'blue' },
  { id: 3, name: 'Можна пізніше', short: 'Пізніше', tone: 'slate' },
];
export const PR = Object.fromEntries(PRIORITIES.map((p) => [p.id, p]));
export const TRANSPORT = [
  { id: 'bus', name: 'Автобус', icon: 'bus' },
  { id: 'car', name: 'Авто', icon: 'car' },
  { id: 'taxi', name: 'Таксі', icon: 'taxi' },
  { id: 'walk', name: 'Пішки', icon: 'walk' },
  { id: 'none', name: 'Без дороги', icon: 'home' },
];
export const TR = Object.fromEntries(TRANSPORT.map((t) => [t.id, t]));
export const BUFFERS = [0, 5, 10, 15, 20, 30];
export const TASK_CATS = [
  { id: 'work', name: 'Робота', icon: 'briefcase' },
  { id: 'family', name: 'Сімʼя', icon: 'users' },
  { id: 'self', name: 'Особисте', icon: 'user' },
  { id: 'money', name: 'Фінанси', icon: 'wallet' },
  { id: 'home', name: 'Побут', icon: 'home' },
  { id: 'study', name: 'Навчання', icon: 'book' },
  { id: 'health', name: 'Здоровʼя', icon: 'heart' },
];
export const TCAT = Object.fromEntries(TASK_CATS.map((c) => [c.id, c]));
// Категорії попередньої версії → нові.
const CAT_V2 = { docs: 'work', train: 'study', buy: 'home' };
export const MODES = [
  { id: 'morning', name: 'Ранок', icon: 'sunrise', tone: 'amber', hint: 'Підготовка і вихід' },
  { id: 'day', name: 'День', icon: 'sun', tone: 'blue', hint: 'Справи за пріоритетами' },
  { id: 'ready', name: 'Готовність', icon: 'shieldCheck', tone: 'teal', hint: 'Перевірки і сценарії на першому місці' },
  { id: 'rest', name: 'Відпочинок', icon: 'moon', tone: 'moon', hint: 'Лише важливе й підсумок дня' },
];
export const MODE = Object.fromEntries(MODES.map((m) => [m.id, m]));
export const REPEATS = [
  { id: '', name: 'Не повторювати' },
  { id: 'daily', name: 'Щодня' },
  { id: 'weekdays', name: 'Пн–Пт' },
  { id: 'weekly', name: 'Щотижня' },
  { id: 'monthly', name: 'Щомісяця' },
];

/* ---------- Ранкові шаблони ---------- */

export const TPL_KINDS = [
  { id: 'work', name: 'Робочий день', icon: 'briefcase' },
  { id: 'study', name: 'Навчання', icon: 'book' },
  { id: 'duty', name: 'Чергування', icon: 'shieldCheck' },
  { id: 'off', name: 'Вихідний', icon: 'sun' },
  { id: 'road', name: 'Дорога', icon: 'car' },
  { id: 'custom', name: 'Власний шаблон', icon: 'layers' },
];
export const TPL_KIND = Object.fromEntries(TPL_KINDS.map((k) => [k.id, k]));
export const BUILTIN_TPL = ['work', 'study', 'duty', 'off', 'road'];
export const TPL_CUSTOM_MAX = 6;
export const ESS_DEFAULT = ['Документи', 'Телефон', 'Ключі', 'Гаманець або картка', 'Павербанк і кабель'];

const TRAVEL = { bus: 40, car: 25, taxi: 20, walk: 35, none: 0 };
function mkStep(title, min, short, extra = {}) {
  return { id: uid(), title, min, short, critical: false, items: [], kind: '', ...extra };
}
const TPL = {
  work: { arrival: '08:30', transport: 'bus', buffer: 15, steps: () => [mkStep('Прокинутися', 5, 2), mkStep('Гігієна', 15, 7), mkStep('Сніданок і вода', 15, 3), mkStep('Особисті речі', 10, 5), mkStep('Перевірка справ', 5, 1, { kind: 'tasks' }), mkStep('Одягнутися й вийти', 5, 5)] },
  study: { arrival: '09:00', transport: 'bus', buffer: 15, steps: () => [mkStep('Прокинутися', 5, 2), mkStep('Гігієна', 15, 7), mkStep('Сніданок і вода', 15, 5), mkStep('Конспекти й матеріали', 10, 5), mkStep('Перевірка справ', 5, 1, { kind: 'tasks' }), mkStep('Одягнутися й вийти', 5, 5)] },
  duty: { arrival: '07:30', transport: 'bus', buffer: 20, steps: () => [mkStep('Прокинутися', 5, 2), mkStep('Гігієна', 10, 5), mkStep('Сніданок і вода', 15, 5), mkStep('Форма й екіпірування', 15, 15, { critical: true, kind: 'gear' }), mkStep('Перевірка справ', 5, 1, { kind: 'tasks' }), mkStep('Вихід', 5, 5)] },
  off: { arrival: '10:00', transport: 'none', buffer: 0, steps: () => [mkStep('Прокинутися без поспіху', 10, 5), mkStep('Гігієна', 15, 10), mkStep('Сніданок', 30, 15), mkStep('Справи на день', 5, 2, { kind: 'tasks' })] },
  road: { arrival: '12:00', transport: 'car', buffer: 20, travel: { car: 180, bus: 240, taxi: 180 }, steps: () => [mkStep('Прокинутися', 5, 2), mkStep('Гігієна', 15, 7), mkStep('Сніданок і вода', 15, 5), mkStep('Речі в дорогу', 15, 10, { items: ['Документи', 'Зарядки', 'Вода', 'Аптечка'] }), mkStep('Перевірка справ', 5, 1, { kind: 'tasks' }), mkStep('Вихід', 5, 5)] },
};

export function defaultTemplate(kind = 'work') {
  const k = TPL[kind] ? kind : 'work';
  const d = TPL[k];
  return { id: `tpl-${k}`, kind: k, name: TPL_KIND[k].name, arrival: d.arrival, transport: d.transport, travel: { ...TRAVEL, ...(d.travel || {}) }, buffer: d.buffer, steps: d.steps() };
}
export const defaultSteps = (kind = 'work') => defaultTemplate(kind).steps;

export function defaultMorning() {
  return { active: 'tpl-work', templates: BUILTIN_TPL.map(defaultTemplate), essentials: ESS_DEFAULT.map((t) => ({ id: uid(), t })) };
}

/* ---------- Стан за замовчуванням ---------- */

export function defaultSettings() {
  return { theme: 'dark', lastBackupAt: 0, installHint: true, name: '', mode: { id: 'auto', until: 0 }, restAt: '21:00', haptics: true, onboarded: false };
}
export function defaultState() {
  return {
    v: SCHEMA,
    updatedAt: 0,
    settings: defaultSettings(),
    morning: defaultMorning(),
    session: null,
    tasks: [],
    musts: [],
    pin: { id: '', date: '' },
    pick: { key: '', date: '' },
    later: {},
    gear: defaultGear(),
    deck: defaultDeck(),
    tools: defaultTools(),
    focus: null,
    days: {},
  };
}

/* ---------- Ранок: план, сесія, «Вихід без забутого» ---------- */

export function tplById(state, id) {
  const list = state.morning.templates;
  return list.find((t) => t.id === id) || list[0];
}
export const currentTpl = (state) => tplById(state, state.morning.active);
export const homeDay = (m) => m.transport === 'none';
export const endLabel = (m) => (homeDay(m) ? 'Початок дня' : 'Вихід');
export const travelOf = (m) => (homeDay(m) ? 0 : m.travel[m.transport] ?? 0);
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

export function newSession(state, nowMs) {
  const tpl = currentTpl(state);
  return { date: planTarget(tpl, localMin(nowMs)), tpl: tpl.id, startedAt: nowMs, done: {}, skipped: {}, checks: {}, short: false, finishedAt: 0, ess: {} };
}

export function activeSession(state, nowLocal) {
  const s = state.session;
  if (!s) return null;
  return dayNum(s.date) * DAY + computePlan(tplById(state, s.tpl)).departure + GRACE >= nowLocal ? s : null;
}

// Шаблон, за яким зараз рахується ранок: сесії, що триває, або обраний.
export function planTpl(state, nowLocal = localMin()) {
  const s = activeSession(state, nowLocal);
  return s ? tplById(state, s.tpl) : currentTpl(state);
}

// Ранок рахується в цілих хвилинах за годинником — так, як час показує телефон.
// Тому все, що бачить людина, сходиться: «зараз 06:26, ще 4 хв — до 06:30».
export const clockMin = (lm) => Math.floor(lm + 1e-6);
// Позначка кроку — мітка часу в мс; у старих даних «пропущено» зберігалося без часу (true).
export const markAt = (v) => (Number.isFinite(+v) && +v > 1e12 ? +v : 0);
// Крок вважається розпочатим з моменту попередньої позначки, якщо вона була не давніше ніж 90 хв тому.
const RUN_WINDOW = 90;

function walk(state, session, short, now) {
  const plan = computePlan(tplById(state, session.tpl), short);
  // Відколи триває поточний крок: остання позначка серед кроків плану або початок підготовки.
  let last = markAt(session.startedAt);
  for (const s of plan.steps) last = Math.max(last, markAt(session.done[s.id]), markAt(session.skipped[s.id]));
  const since = clockMin(localMin(last));
  const rows = [];
  let cursor = now, remaining = 0, current = null;
  for (const s of plan.steps) {
    const st = session.done[s.id] ? 'done' : session.skipped[s.id] ? 'skipped' : s.dur === 0 ? 'auto' : 'todo';
    const row = { ...s, planStart: s.start, state: st, start: null, end: null, left: 0, over: 0, doneAt: markAt(session.done[s.id]), skipAt: markAt(session.skipped[s.id]) };
    if (st === 'todo') {
      let start = cursor, left = s.dur;
      if (!current) {
        const elapsed = now - since;
        if (elapsed >= 0 && elapsed <= RUN_WINDOW) {
          start = since;
          left = Math.max(0, s.dur - elapsed);
          row.over = Math.max(0, elapsed - s.dur);
        }
        current = row;
      }
      row.start = start;
      row.left = left;
      row.end = cursor + left;
      cursor += left;
      remaining += left;
    }
    rows.push(row);
  }
  return { plan, rows, remaining, current };
}

// Стан ранкової підготовки на момент nowMs. Усі величини — цілі хвилини й узгоджені між собою:
// expected = зараз + залишок кроків; spare = план виходу − expected (відʼємний — запізнення).
export function sessionStatus(state, session, nowMs) {
  const now = clockMin(localMin(nowMs));
  const short = !!session.short;
  const main = walk(state, session, short, now);
  const alt = walk(state, session, true, now);
  const depAt = dayNum(session.date) * DAY + main.plan.departure;
  const expected = now + main.remaining;
  const spare = depAt - expected;
  const altSpare = depAt - (now + alt.remaining);
  let level = 'ok';
  if (spare < 0) level = !short && altSpare >= 0 ? 'tight' : 'late';
  const counted = main.rows.filter((r) => r.state !== 'auto');
  const ess = state.morning.essentials;
  const essDone = ess.filter((e) => session.ess?.[e.id]).length;
  const finished = !main.current;
  const complete = finished && essDone === ess.length;
  return {
    ...main, now, depAt, toDep: depAt - now, spare, altSpare, level, short,
    expected,
    finished,
    complete,
    needEss: finished && !complete,
    essDone,
    essTotal: ess.length,
    doneCount: counted.filter((r) => r.state === 'done' || r.state === 'skipped').length,
    count: counted.length,
    index: main.current ? counted.findIndex((r) => r.id === main.current.id) + 1 : counted.length,
  };
}

// Короткий підсумок ранку для головного екрана.
export function morningSummary(state, nowMs) {
  const now = clockMin(localMin(nowMs));
  const session = activeSession(state, now);
  const tpl = session ? tplById(state, session.tpl) : currentTpl(state);
  const plan = computePlan(tpl);
  const date = session ? session.date : planTarget(tpl, now);
  const base = dayNum(date) * DAY;
  const wakeAt = base + plan.wake, depAt = base + plan.departure;
  let phase = 'before';
  if (session) phase = session.finishedAt ? 'finished' : 'running';
  else if (now >= depAt) phase = 'after';
  else if (now >= wakeAt) phase = 'window';
  return { tpl, plan, date, rel: dayNum(date) - Math.floor(now / DAY), wakeAt, depAt, now, phase, session, toWake: wakeAt - now, toDep: depAt - now };
}

export function moveItem(list, id, dir) {
  const i = list.findIndex((x) => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const copy = list.slice();
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

/* ---------- Справи ---------- */

export const normTitle = (s) => String(s).toLowerCase().replace(/[’'ʼ`"«».,!?;:()\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
export const isOpen = (x) => !x.doneAt && !x.cancelledAt;

export function findDuplicate(list, title, exceptId = '') {
  const n = normTitle(title);
  return n ? list.find((t) => isOpen(t) && t.id !== exceptId && normTitle(t.title) === n) || null : null;
}

export function newTask(title, pr, due, nowMs = Date.now(), extra = {}) {
  const id = uid();
  return {
    id, title: String(title).trim().slice(0, 300), pr, due, time: '', deadline: '', cat: '', note: '', sub: [], rep: null, sid: id, next: '',
    createdAt: nowMs, doneAt: 0, cancelledAt: 0, moved: 0, ...extra,
  };
}

// Перенесення: та сама справа на новий день, без копії. Дедлайн не змінюється.
export function postpone(task, today, to = '') {
  const base = task.due && task.due > today ? task.due : today;
  return { ...task, due: isKey(to) ? to : addDays(base, 1), moved: (task.moved || 0) + 1 };
}

const cmpKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const timeOrder = (t) => (t.time ? parseHM(t.time) ?? DAY : DAY);
const dlKey = (t) => t.deadline || '9999-12-31';
export const byTask = (a, b) => a.pr - b.pr || cmpKey(dlKey(a), dlKey(b)) || cmpKey(a.due, b.due) || timeOrder(a) - timeOrder(b) || a.createdAt - b.createdAt;

export function taskView(tasks, today, pin = null) {
  const open = tasks.filter(isOpen);
  const overdue = open.filter((t) => t.due && t.due < today).sort(byTask);
  const todays = open.filter((t) => t.due === today).sort(byTask);
  const upcoming = open.filter((t) => t.due > today).sort((a, b) => cmpKey(a.due, b.due) || a.pr - b.pr || timeOrder(a) - timeOrder(b) || a.createdAt - b.createdAt);
  const nodate = open.filter((t) => !t.due).sort((a, b) => a.pr - b.pr || cmpKey(dlKey(a), dlKey(b)) || a.createdAt - b.createdAt);
  const doneToday = tasks.filter((t) => t.doneAt && !t.cancelledAt && todayKey(t.doneAt) === today).sort((a, b) => b.doneAt - a.doneAt);
  const ordered = [...overdue, ...todays].sort(byTask);
  let main = ordered[0] || null;
  if (pin && pin.date === today) {
    const p = ordered.find((t) => t.id === pin.id);
    if (p) main = p;
  }
  const rest = ordered.filter((t) => t !== main);
  return {
    overdue, today: todays, upcoming, nodate, doneToday, ordered,
    main, top: rest.slice(0, 3), more: rest.slice(3),
    focus: ordered.slice(0, 3),
    groups: PRIORITIES.map((p) => ({ ...p, items: todays.filter((t) => t.pr === p.id) })),
    openCount: ordered.length,
  };
}

export function matches(item, q = '', cat = '') {
  if (cat && item.cat !== cat) return false;
  const n = normTitle(q);
  if (!n) return true;
  return normTitle(item.title).includes(n) || normTitle(item.note || '').includes(n) || (item.sub || []).some((s) => normTitle(s.t).includes(n));
}

// Архів: виконане й скасоване, найновіше першим.
export function archiveView(state, q = '', cat = '') {
  const pack = (type) => (x) => ({ type, x, at: x.doneAt || x.cancelledAt, how: x.doneAt ? 'done' : 'cancel' });
  const tasks = state.tasks.filter((t) => !isOpen(t) && matches(t, q, cat)).map(pack('task'));
  const musts = cat ? [] : state.musts.filter((m) => !isOpen(m) && matches(m, q)).map(pack('must'));
  return [...tasks, ...musts].sort((a, b) => b.at - a.at);
}

/* ---------- Повторювані справи ---------- */

export function nextDue(rep, from) {
  if (!rep) return '';
  if (rep.k === 'daily') return addDays(from, 1);
  if (rep.k === 'weekdays') {
    let k = addDays(from, 1);
    while (weekday(k) === 0 || weekday(k) === 6) k = addDays(k, 1);
    return k;
  }
  if (rep.k === 'weekly') {
    const days = rep.days?.length ? rep.days : [weekday(from)];
    let k = addDays(from, 1);
    for (let i = 0; i < 7 && !days.includes(weekday(k)); i++) k = addDays(k, 1);
    return k;
  }
  if (rep.k === 'monthly') {
    const [y, m, d] = from.split('-').map(Number);
    const dom = rep.dom || d;
    const build = (yy, mm) => {
      const last = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
      return `${yy}-${String(mm).padStart(2, '0')}-${String(Math.min(dom, last)).padStart(2, '0')}`;
    };
    const same = build(y, m);
    if (same > from) return same;
    return m === 12 ? build(y + 1, 1) : build(y, m + 1);
  }
  return '';
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export function repLabel(rep) {
  if (!rep) return '';
  if (rep.k === 'daily') return 'щодня';
  if (rep.k === 'weekdays') return 'пн–пт';
  if (rep.k === 'weekly') return rep.days?.length ? `щотижня: ${WEEK_ORDER.filter((d) => rep.days.includes(d)).map((d) => WD_S[d]).join(', ')}` : 'щотижня';
  if (rep.k === 'monthly') return `щомісяця, ${rep.dom}-го`;
  return '';
}

export function makeRep(k, due, days = []) {
  if (!due) return null;
  if (k === 'daily' || k === 'weekdays') return { k };
  if (k === 'weekly') return { k, days: days.length ? [...new Set(days)].filter((d) => d >= 0 && d <= 6).sort() : [weekday(due)] };
  if (k === 'monthly') return { k, dom: +due.slice(8) };
  return null;
}

// Виконати справу. Для повторюваної — створюється наступна, якщо її ще немає.
export function completeTask(state, id, nowMs = Date.now()) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t || t.doneAt || t.cancelledAt) return null;
  t.doneAt = nowMs;
  let spawned = null;
  if (t.rep) {
    const exists = state.tasks.some((x) => isOpen(x) && x.sid === t.sid && x.id !== t.id);
    if (!exists) {
      const today = todayKey(nowMs);
      const due = nextDue(t.rep, t.due > today ? t.due : today);
      spawned = newTask(t.title, t.pr, due, nowMs, {
        time: t.time, cat: t.cat, note: t.note, rep: { ...t.rep }, sid: t.sid,
        sub: t.sub.map((s) => ({ id: uid(), t: s.t, d: 0 })),
      });
      state.tasks.push(spawned);
      t.next = spawned.id;
    }
  }
  if (state.pin.id === id) state.pin = { id: '', date: '' };
  return { task: t, spawned };
}

export function undoTask(state, id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  t.doneAt = 0;
  if (t.next) {
    const n = state.tasks.find((x) => x.id === t.next);
    if (n && isOpen(n) && !n.moved) state.tasks = state.tasks.filter((x) => x !== n);
    t.next = '';
  }
}

export function cancelTask(state, id, nowMs = Date.now()) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t || !isOpen(t)) return false;
  t.cancelledAt = nowMs;
  if (state.pin.id === id) state.pin = { id: '', date: '' };
  return true;
}

// Повернути з архіву: справа знову в роботі.
export function restoreTask(state, id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  if (t.doneAt) undoTask(state, id);
  t.cancelledAt = 0;
}

export function subProgress(t) {
  const done = t.sub.filter((s) => s.d).length;
  return { done, total: t.sub.length, next: t.sub.find((s) => !s.d) || null };
}

const SEV = { normal: 0, soon: 1, late: 2 };

// Шкала строку: яка частка часу вже минула (реальні дані, не прикраса).
export function deadlineInfo(item, nowMs = Date.now(), kind = 'task') {
  const now = localMin(nowMs);
  const today = keyOfLocal(now);
  if (item.doneAt || item.cancelledAt) return null;
  const created = localMin(item.createdAt || nowMs);
  const toward = (key) => {
    const end = localAt(key, DAY);
    return Math.min(1, Math.max(0, (now - created) / Math.max(1, end - created)));
  };
  if (kind === 'must') {
    if (!item.deadline) return null;
    const left = diffDays(today, item.deadline);
    const frac = toward(item.deadline);
    if (left < 0) return { frac: 1, level: 'late', text: `строк минув ${daysWord(-left)} тому` };
    if (left === 0) return { frac, level: 'soon', text: 'строк — сьогодні' };
    if (left === 1) return { frac, level: 'soon', text: 'строк — завтра' };
    return { frac, level: 'normal', text: `до ${shortDate(item.deadline, today)} (ще ${daysWord(left)})` };
  }
  let due = null;
  if (item.due && item.due < today) {
    const n = diffDays(item.due, today);
    due = { frac: 1, level: 'late', text: n === 1 ? 'прострочено з учора' : `прострочено ${daysWord(n)}` };
  } else if (item.due === today) {
    const at = item.time ? localAt(today, parseHM(item.time)) : localAt(today, DAY);
    const start = Math.min(Math.max(created, localAt(today, 0)), at - 1);
    const frac = Math.min(1, Math.max(0, (now - start) / Math.max(1, at - start)));
    if (item.time) due = now > at ? { frac: 1, level: 'late', text: `мало бути о ${item.time}` } : { frac, level: at - now <= 60 ? 'soon' : 'normal', text: `о ${item.time}, ${relIn(at - now)}`, at };
    else due = { frac, level: frac > 0.8 ? 'soon' : 'normal', text: 'до кінця дня' };
  }
  if (item.deadline) {
    const left = diffDays(today, item.deadline);
    const frac = toward(item.deadline);
    let d;
    if (left < 0) d = { frac: 1, level: 'late', text: left === -1 ? 'дедлайн минув учора' : `дедлайн минув ${daysWord(-left)} тому` };
    else if (left === 0) d = { frac, level: 'soon', text: 'дедлайн сьогодні' };
    else if (left === 1) d = { frac, level: 'soon', text: 'дедлайн завтра' };
    else d = { frac, level: 'normal', text: `дедлайн ${shortDate(item.deadline, today)}` };
    if (!due || SEV[d.level] > SEV[due.level]) return d;
  }
  return due;
}

/* ---------- «Не забути»: на виду, доки не ухвалено рішення ---------- */

export function newMust(title, deadline = '', nowMs = Date.now()) {
  return { id: uid(), title: String(title).trim().slice(0, 300), note: '', deadline, createdAt: nowMs, doneAt: 0, cancelledAt: 0, returnOn: '', moved: 0 };
}

export function mustView(musts, today) {
  const open = musts
    .filter(isOpen)
    .map((m) => ({ ...m, age: Math.max(0, diffDays(todayKey(m.createdAt), today)), left: m.deadline ? diffDays(today, m.deadline) : null, parked: !!m.returnOn && m.returnOn > today }))
    .sort((a, b) => a.parked - b.parked || (a.parked ? cmpKey(a.returnOn, b.returnOn) : 0) || (a.left ?? 1e9) - (b.left ?? 1e9) || a.createdAt - b.createdAt);
  const done = musts.filter((m) => m.doneAt).sort((a, b) => b.doneAt - a.doneAt);
  const cancelled = musts.filter((m) => m.cancelledAt && !m.doneAt).sort((a, b) => b.cancelledAt - a.cancelledAt);
  return { open, active: open.filter((m) => !m.parked), parked: open.filter((m) => m.parked), done, cancelled };
}

// Явне рішення «Перенести»: справа лишається у списку, але повертається до уваги з обраної дати.
export function moveMust(m, date) {
  return { ...m, returnOn: isKey(date) ? date : '', moved: (m.moved || 0) + 1 };
}

/* ---------- Режими дня ---------- */

export function autoMode(state, nowMs = Date.now()) {
  const sm = morningSummary(state, nowMs);
  if (sm.phase === 'running') return 'morning';
  if (sm.rel === 0 && sm.now >= sm.wakeAt - 60 && sm.now < sm.depAt) return 'morning';
  const min = minOfDay(sm.now);
  const restAt = parseHM(state.settings.restAt) ?? 1260;
  if (min >= restAt || min < 240) return 'rest';
  return 'day';
}

export function modeInfo(state, nowMs = Date.now()) {
  const now = localMin(nowMs);
  const m = state.settings.mode;
  const manual = m && MODE[m.id] && (!m.until || m.until > now) ? m.id : '';
  const auto = autoMode(state, nowMs);
  return { id: manual || auto, manual: !!manual, auto, until: manual ? m.until : 0 };
}

// Ручний режим діє до кінця доби або до скасування.
export function setMode(state, id, untilEndOfDay = true, nowMs = Date.now()) {
  if (id === 'auto' || !MODE[id]) { state.settings.mode = { id: 'auto', until: 0 }; return; }
  const now = localMin(nowMs);
  state.settings.mode = { id, until: untilEndOfDay ? (Math.floor(now / DAY) + 1) * DAY : 0 };
}

/* ---------- Відкладання ---------- */

export function isDeferred(state, key, nowMs = Date.now()) {
  return (state.later[key] || 0) > localMin(nowMs);
}
export function defer(state, key, minutes, nowMs = Date.now()) {
  state.later[key] = localMin(nowMs) + minutes;
}
export function deferTomorrow(state, key, nowMs = Date.now()) {
  const now = localMin(nowMs);
  state.later[key] = (Math.floor(now / DAY) + 1) * DAY + 240;
}

/* ---------- Наступна дія: детермінований і прозорий порядок ---------- */
// Порядок: ранок, що триває → події найближчої години → обране вами → прострочені строки →
// «Обовʼязково» → «Не забути» зі строком → «Важливо» → перевірки → «Пізніше». Режим дня зсуває акценти.

const ORDER_MAX = 1e12;
const sentence = (parts) => { const s = parts.filter(Boolean).join(', '); return s.charAt(0).toUpperCase() + s.slice(1); };

export function candidates(state, nowMs = Date.now(), modeId = '') {
  const now = localMin(nowMs);
  const today = keyOfLocal(now);
  const mode = modeId || modeInfo(state, nowMs).id;
  const out = [];
  const free = (key) => !isDeferred(state, key, nowMs);

  // Ранок
  const sm = morningSummary(state, nowMs);
  const end = endLabel(sm.tpl).toLowerCase();
  if (sm.phase === 'running') {
    const st = sessionStatus(state, sm.session, nowMs);
    const c = st.current;
    if (c) {
      const reason = st.level === 'ok' ? `Крок ${st.index} із ${st.count}, ${end} о ${fmtHM(st.plan.departure)}`
        : st.level === 'tight' ? `Часу обмаль: бракує ${fmtDur(-st.spare)}` : `Запізнення на ${fmtDur(-st.spare)}, ${end} о ${fmtHM(st.plan.departure)}`;
      out.push({ key: `step:${c.id}`, kind: 'step', id: c.id, rank: 10, title: c.title, reason, at: c.end, level: st.level === 'ok' ? 'normal' : 'warn', critical: c.critical, blocked: c.items.length > 0, icon: 'sunrise', defer: false });
    } else if (st.needEss) {
      out.push({ key: 'ess', kind: 'ess', rank: 10, title: 'Вихід без забутого', reason: `Перевірте перед виходом: ще ${st.essTotal - st.essDone} з ${st.essTotal}`, level: 'normal', icon: 'checkCircle', defer: false });
    }
  } else if (sm.rel === 0 && mode !== 'rest' && (sm.phase === 'window' || (sm.phase === 'before' && mode === 'morning' && sm.toWake <= 60))) {
    const key = `morning:${sm.date}`;
    if (free(key)) {
      out.push({
        key, kind: 'morning', rank: mode === 'morning' ? 12 : 25, title: 'Почати ранкову підготовку',
        reason: sm.phase === 'window' ? `${sm.tpl.name}: ${end} о ${fmtHM(sm.plan.departure)}, ${relIn(sm.toDep)}` : `${sm.tpl.name}: підйом о ${fmtHM(sm.plan.wake)}, ${relIn(sm.toWake)}`,
        at: sm.depAt, level: sm.phase === 'window' ? 'warn' : 'normal', icon: 'sunrise', defer: true,
      });
    }
  }

  // Розпочаті перевірки та сценарії
  for (const cat of Object.keys(state.gear.active)) {
    const key = `gearrun:${cat}`;
    if (!free(key)) continue;
    const run = state.gear.active[cat];
    const items = state.gear.cats[cat]?.items || [];
    const marked = items.filter((i) => run.marks[i.id]).length;
    out.push({ key, kind: 'gearRun', cat, rank: mode === 'ready' ? 13 : 40, title: 'Завершити перевірку', reason: `Перевірка триває, позначено ${marked} з ${items.length}`, level: 'normal', icon: 'shieldCheck', defer: true });
  }
  const run = state.deck.active;
  if (run && free(`deckrun:${run.id}`)) {
    const sc = state.deck.scenarios.find((s) => s.id === run.sid);
    const pr = runProgress(run, sc);
    out.push({ key: `deckrun:${run.id}`, kind: 'deckRun', id: run.id, rank: mode === 'ready' ? 14 : mode === 'rest' ? 40 : 15, title: `Продовжити: ${run.title}`, reason: `Сценарій триває, виконано ${pr.done} з ${pr.total}`, level: 'normal', icon: 'play', defer: true });
  }

  // Справи
  const tv = taskView(state.tasks, today, state.pin);
  for (const t of tv.ordered) {
    const key = `task:${t.id}`;
    if (!free(key)) continue;
    const overdue = t.due < today;
    const at = t.time && t.due === today ? localAt(today, parseHM(t.time)) : null;
    const pinned = tv.main === t && state.pin.date === today && state.pin.id === t.id;
    const dl = t.deadline ? diffDays(today, t.deadline) : null;
    let rank;
    // Подія найближчої години — першою. Пропущена лишається першою недовго (залежно від пріоритету:
    // «Обовʼязково» — 2 год, «Важливо» — 1 год, «Можна пізніше» — 30 хв), далі стає звичайною справою.
    const missWindow = t.pr === 1 ? 120 : t.pr === 2 ? 60 : 30;
    if (at != null && at - now <= 60 && now - at <= missWindow) rank = 18;
    else if (pinned) rank = mode === 'rest' ? 31 : 19;
    else if (dl != null && dl <= 0) rank = mode === 'rest' ? 31 : 21;
    else if (mode === 'rest') rank = t.pr === 1 ? (overdue ? 31 : 32) : 60 + t.pr;
    else rank = t.pr === 1 ? (overdue ? 22 : 24) : 26 + t.pr * 2 - (overdue ? 1 : 0) - (dl === 1 ? 1 : 0);
    const parts = [pinned ? 'Головне на сьогодні' : PR[t.pr].name];
    if (dl != null && dl < 0) parts.push(dl === -1 ? 'дедлайн минув учора' : `дедлайн минув ${daysWord(-dl)} тому`);
    else if (dl === 0) parts.push('дедлайн сьогодні');
    else if (dl === 1) parts.push('дедлайн завтра');
    if (overdue) parts.push(diffDays(t.due, today) === 1 ? 'прострочено з учора' : `прострочено з ${shortDate(t.due, today)}`);
    if (at != null) parts.push(at < now ? `мало бути о ${t.time}` : `о ${t.time}, ${relIn(at - now)}`);
    const sp = subProgress(t);
    if (sp.total) parts.push(`кроків ${sp.done} з ${sp.total}`);
    out.push({
      key, kind: 'task', id: t.id, rank, order: [t.pr, dl ?? 1e6, dayNum(t.due), at ?? ORDER_MAX, t.createdAt], title: t.title, reason: sentence(parts), at,
      level: overdue || (at != null && at < now) || (dl != null && dl < 0) ? 'warn' : 'normal', icon: t.cat ? TCAT[t.cat].icon : 'list', pr: t.pr, defer: true,
    });
  }

  // «Не забути»
  const mv = mustView(state.musts, today);
  for (const m of mv.active) {
    const key = `must:${m.id}`;
    if (!free(key)) continue;
    let rank, reason;
    if (m.left !== null && m.left < 0) { rank = mode === 'rest' ? 30 : 20; reason = `Не забути: строк минув ${daysWord(-m.left)} тому`; }
    else if (m.left === 0) { rank = mode === 'rest' ? 30 : 20; reason = 'Не забути: строк сьогодні'; }
    else if (m.left === 1) { rank = 27; reason = 'Не забути: строк завтра'; }
    else { rank = mode === 'rest' ? 62 : 29; reason = m.age ? `Не забути: у списку ${daysWord(m.age)}` : 'Не забути: додано сьогодні'; }
    out.push({ key, kind: 'must', id: m.id, rank, order: [m.left ?? 1e6, m.createdAt], title: m.title, reason, level: m.left !== null && m.left <= 0 ? 'warn' : 'normal', icon: 'pin', defer: true });
  }

  // Готовність
  const RANKS = { issues: { ready: 15, day: 33, morning: 50, rest: 34 }, needs: { ready: 16, day: 36, morning: 52, rest: 35 } };
  for (const c of gearSummary(state.gear, nowMs).cats) {
    const s = c.st.s;
    if (s !== 'issues' && s !== 'needs') continue;
    const key = `gear:${c.id}`;
    if (!free(key)) continue;
    out.push({ key, kind: 'gear', cat: c.id, rank: RANKS[s][mode], title: s === 'issues' ? `Усунути проблеми: ${c.name}` : `Перевірити: ${c.name}`, reason: c.st.text, level: s === 'issues' ? 'warn' : 'normal', icon: c.icon, defer: true, fix: s === 'issues' });
  }

  // Вечір: підсумок дня
  if (mode === 'rest') {
    const day = closeoutDay(nowMs);
    const key = `evening:${day}`;
    if (!state.days[day] && free(key)) out.push({ key, kind: 'evening', rank: 70, title: 'Підбити підсумок дня', reason: 'Що зроблено, що перенести і що головне завтра', level: 'normal', icon: 'moon', defer: true });
  }

  // Резервна копія
  const hasData = state.tasks.length + state.musts.length + state.gear.history.length > 0;
  const lb = state.settings.lastBackupAt;
  const stale = !lb || diffDays(todayKey(lb), today) > 7;
  if (hasData && stale && (mode === 'day' || mode === 'rest') && free('backup')) {
    out.push({ key: 'backup', kind: 'backup', rank: 80, title: 'Створити резервну копію', reason: lb ? `Остання копія ${daysWord(diffDays(todayKey(lb), today))} тому` : 'Копій ще не було', level: 'normal', icon: 'share', defer: true });
  }

  out.sort((a, b) => a.rank - b.rank || cmpArr(a.order, b.order));

  // «Обрати іншу»: ваш вибір стає першим до виконання або до кінця дня.
  const pick = state.pick;
  if (pick && pick.key && pick.date === today) {
    const i = out.findIndex((c) => c.key === pick.key);
    if (i >= 0) {
      const [c] = out.splice(i, 1);
      out.unshift({ ...c, picked: true, reason: `Обрано вами. ${c.reason}` });
    }
  }
  return out;
}

function cmpArr(a = [], b = []) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

export function nextAction(state, nowMs = Date.now()) {
  const mode = modeInfo(state, nowMs);
  const list = candidates(state, nowMs, mode.id);
  return { mode, main: list[0] || null, then: list[1] || null, list };
}

/* ---------- Події дня ---------- */

export function dayEvents(state, nowMs = Date.now()) {
  const now = localMin(nowMs);
  const today = keyOfLocal(now);
  const base = dayNum(today) * DAY;
  const events = [];
  const tpl = planTpl(state, now);
  const p = computePlan(tpl);
  const sm = morningSummary(state, nowMs);
  const morningDone = sm.session && sm.session.date === today && !!sm.session.finishedAt;
  if (!p.wakePrevDay) events.push({ t: base + p.wake, kind: 'wake', title: 'Підйом', done: morningDone || now > base + p.wake });
  if (p.departure >= 0) events.push({ t: base + p.departure, kind: 'dep', title: endLabel(tpl), done: now > base + p.departure });
  if (!homeDay(tpl) && p.arrival < DAY) events.push({ t: base + p.arrival, kind: 'arr', title: 'Прибуття', done: now > base + p.arrival });
  for (const t of state.tasks) {
    if (t.due !== today || !t.time || t.cancelledAt) continue;
    const m = parseHM(t.time);
    if (m == null) continue;
    events.push({ t: base + m, kind: 'task', title: t.title, id: t.id, done: !!t.doneAt, pr: t.pr });
  }
  events.sort((a, b) => a.t - b.t || (a.kind === 'task') - (b.kind === 'task'));
  return { events, now, base };
}

/* ---------- Пульс дня ---------- */
// Лише реальні дані: виконані справи, невиконані пріоритети, найближча подія, прострочене, потрібні перевірки.

export function pulseData(state, nowMs = Date.now()) {
  const now = localMin(nowMs);
  const today = keyOfLocal(now);
  const tv = taskView(state.tasks, today, state.pin);
  const mv = mustView(state.musts, today);
  const done = tv.doneToday.length;
  const open = tv.openCount;
  const total = done + open;
  const ev = dayEvents(state, nowMs);
  const gs = gearSummary(state.gear, nowMs);
  const beats = [];
  const onToday = (ms) => ms && todayKey(ms) === today;
  for (const t of state.tasks) if (!t.cancelledAt && onToday(t.doneAt)) beats.push({ m: minOfDay(localMin(t.doneAt)), k: 'task' });
  for (const m of state.musts) if (onToday(m.doneAt)) beats.push({ m: minOfDay(localMin(m.doneAt)), k: 'must' });
  for (const c of state.gear.history) if (onToday(c.finishedAt)) beats.push({ m: minOfDay(localMin(c.finishedAt)), k: 'check' });
  for (const r of state.deck.runs) if (onToday(r.finishedAt)) beats.push({ m: minOfDay(localMin(r.finishedAt)), k: 'run' });
  beats.sort((a, b) => a.m - b.m);
  return {
    done, open, total,
    pct: total ? Math.round((done / total) * 100) : null,
    prioOpen: tv.ordered.filter((t) => t.pr <= 2).length,
    overdue: tv.overdue.length + mv.active.filter((m) => m.left !== null && m.left < 0).length,
    next: ev.events.find((e) => e.t > now && !e.done) || null,
    checks: gs.issues + gs.needs,
    gearIssues: gs.issues,
    gearNeeds: gs.needs,
    beats,
    events: ev.events.map((e) => ({ m: minOfDay(e.t), kind: e.kind, done: e.done, title: e.title })),
    nowMin: minOfDay(now),
  };
}

export function daySummary(state, nowMs = Date.now()) {
  const today = todayKey(nowMs);
  const tv = taskView(state.tasks, today);
  const mv = mustView(state.musts, today);
  const gs = gearSummary(state.gear, nowMs);
  const parts = [];
  if (tv.openCount) parts.push(count(tv.openCount, ['справа', 'справи', 'справ']));
  if (tv.overdue.length) parts.push(`з них прострочено ${tv.overdue.length}`);
  if (mv.active.length) parts.push(`не забути ${mv.active.length}`);
  if (gs.issues) parts.push(count(gs.issues, ['категорія з проблемами', 'категорії з проблемами', 'категорій з проблемами']));
  else if (gs.needs) parts.push(count(gs.needs, ['перевірка потрібна', 'перевірки потрібні', 'перевірок потрібно']));
  if (!parts.length) return tv.doneToday.length ? 'Усе важливе на сьогодні зроблено' : 'Справ на сьогодні немає';
  return parts.join(', ');
}

/* ---------- Вечірній підсумок ---------- */

// До 04:00 підсумок стосується попереднього дня.
export function closeoutDay(nowMs = Date.now()) {
  const now = localMin(nowMs);
  return minOfDay(now) < 240 ? keyOfLocal(now - DAY) : keyOfLocal(now);
}

export function eveningData(state, nowMs = Date.now()) {
  const day = closeoutDay(nowMs);
  const tomorrow = addDays(day, 1);
  const tv = taskView(state.tasks, day, state.pin);
  const doneMusts = state.musts.filter((m) => m.doneAt && todayKey(m.doneAt) === day);
  const tomorrowTasks = state.tasks.filter((t) => isOpen(t) && t.due === tomorrow).sort(byTask);
  const tpl = currentTpl(state);
  return {
    day, tomorrow,
    doneTasks: tv.doneToday, doneMusts,
    remaining: tv.ordered,
    musts: mustView(state.musts, day).active,
    tomorrowTasks,
    tpl, plan: computePlan(tpl),
    pinTomorrow: state.pin.date === tomorrow ? state.pin.id : '',
    closed: state.days[day] || null,
  };
}

export function closeDay(state, nowMs = Date.now(), moved = 0) {
  const ed = eveningData(state, nowMs);
  state.days[ed.day] = { at: nowMs, done: ed.doneTasks.length + ed.doneMusts.length, moved: Math.max(0, moved | 0) };
  const keys = Object.keys(state.days).sort();
  while (keys.length > 90) delete state.days[keys.shift()];
  return ed.day;
}

/* ---------- Підсумки тижня ---------- */

export function weekStats(state, nowMs = Date.now(), n = 7) {
  const today = todayKey(nowMs);
  const rows = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    rows.push({ date: d, tasks: 0, musts: 0, checks: 0, runs: 0, closed: !!state.days[d] });
  }
  const idx = Object.fromEntries(rows.map((r, i) => [r.date, i]));
  const add = (ms, f) => { if (!ms) return; const k = todayKey(ms); if (k in idx) rows[idx[k]][f]++; };
  for (const t of state.tasks) if (!t.cancelledAt) add(t.doneAt, 'tasks');
  for (const m of state.musts) add(m.doneAt, 'musts');
  for (const c of state.gear.history) add(c.finishedAt, 'checks');
  for (const r of state.deck.runs) add(r.finishedAt, 'runs');
  const sum = (f) => rows.reduce((s, r) => s + r[f], 0);
  return {
    rows,
    tasks: sum('tasks'), musts: sum('musts'), checks: sum('checks'), runs: sum('runs'),
    closed: rows.filter((r) => r.closed).length,
    max: Math.max(1, ...rows.map((r) => r.tasks + r.musts)),
  };
}

/* ---------- Таймер «Фокусу» ---------- */

export function focusLeft(state, nowMs = Date.now()) {
  const f = state.focus;
  if (!f) return null;
  const end = f.start + f.mins * 60000;
  return { id: f.id, mins: f.mins, left: Math.max(0, Math.ceil((end - nowMs) / 1000)), over: nowMs >= end, end };
}

/* ---------- Очищення застарілого ---------- */

// Виконане й скасоване зберігається в архіві 180 днів (не більше 1500 записів).
export function purge(state, nowMs = Date.now()) {
  const cut = nowMs - ARCHIVE_DAYS * 864e5;
  const closedAt = (x) => x.doneAt || x.cancelledAt || 0;
  const keep = (list) => {
    let out = list.filter((x) => !closedAt(x) || closedAt(x) > cut);
    const archived = out.filter(closedAt).sort((a, b) => closedAt(b) - closedAt(a));
    if (archived.length > ARCHIVE_MAX) {
      const drop = new Set(archived.slice(ARCHIVE_MAX));
      out = out.filter((x) => !drop.has(x));
    }
    return out;
  };
  state.tasks = keep(state.tasks);
  state.musts = keep(state.musts);
  if (state.later) {
    const now = localMin(nowMs);
    for (const [k, v] of Object.entries(state.later)) if (!(v > now)) delete state.later[k];
  }
  const today = todayKey(nowMs);
  if (state.pin && state.pin.date && state.pin.date < today) state.pin = { id: '', date: '' };
  if (state.pick && state.pick.date !== today) state.pick = { key: '', date: '' };
  return state;
}

/* ---------- Перевірка даних, міграції, резервні копії ---------- */

const str = (s, max) => (typeof s === 'string' ? s.slice(0, max) : '');
const int = (v, lo, hi, d) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const stamp = (v) => (Number.isFinite(+v) && +v > 0 ? +v : 0);
const plain = (o) => o && typeof o === 'object' && !Array.isArray(o);
const okId = (v) => typeof v === 'string' && /^[\w-]{1,64}$/.test(v);
const cleanId = (v) => (okId(v) ? v : uid());

function cleanRep(r, due) {
  if (!plain(r) || !due) return null;
  if (r.k === 'daily' || r.k === 'weekdays') return { k: r.k };
  if (r.k === 'weekly') {
    const days = Array.isArray(r.days) ? [...new Set(r.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [];
    return { k: 'weekly', days: days.length ? days : [weekday(due)] };
  }
  if (r.k === 'monthly') return { k: 'monthly', dom: int(r.dom, 1, 31, +due.slice(8)) };
  return null;
}

function cleanSettings(st) {
  const d = defaultSettings();
  if (!plain(st)) return d;
  const mode = plain(st.mode) && (st.mode.id === 'auto' || MODE[st.mode.id]) ? { id: st.mode.id, until: stamp(st.mode.until) } : d.mode;
  return {
    theme: ['auto', 'light', 'dark'].includes(st.theme) ? st.theme : 'dark',
    lastBackupAt: stamp(st.lastBackupAt),
    installHint: st.installHint !== false,
    name: str(st.name, 40).trim(),
    mode: mode.id === 'auto' ? { id: 'auto', until: 0 } : mode,
    restAt: parseHM(st.restAt) == null ? d.restAt : fmtHM(parseHM(st.restAt)),
    haptics: st.haptics !== false,
    onboarded: st.onboarded === true,
  };
}

function cleanSteps(list, dflt, counter) {
  if (!Array.isArray(list)) return dflt;
  const ids = new Set();
  const steps = [];
  for (const s of list.slice(0, 40)) {
    const title = plain(s) ? str(s.title, 80).trim() : '';
    if (!title) { counter.dropped++; continue; }
    const min = int(s.min, 1, 180, 5);
    const critical = s.critical === true;
    let id = cleanId(s.id);
    if (ids.has(id)) id = uid();
    ids.add(id);
    steps.push({
      id, title, min, critical,
      short: critical ? min : int(s.short, 0, min, min),
      items: Array.isArray(s.items) ? s.items.map((x) => str(x, 60).trim()).filter(Boolean).slice(0, 12) : [],
      kind: s.kind === 'tasks' || s.kind === 'gear' ? s.kind : '',
    });
  }
  return steps;
}

function cleanTpl(raw, kind, counter) {
  if (!plain(raw)) return null;
  const k = TPL_KIND[kind] ? kind : 'custom';
  const d = defaultTemplate(k === 'custom' ? 'work' : k);
  const travel = {};
  for (const t of TRANSPORT) travel[t.id] = t.id === 'none' ? 0 : int(raw.travel?.[t.id], 0, 600, d.travel[t.id]);
  const arr = parseHM(raw.arrival);
  const name = str(raw.name, 40).trim() || TPL_KIND[k].name;
  return {
    id: k === 'custom' ? cleanId(raw.id) : `tpl-${k}`,
    kind: k,
    name,
    arrival: arr == null ? d.arrival : fmtHM(arr),
    transport: TR[raw.transport] ? raw.transport : d.transport,
    travel,
    buffer: BUFFERS.includes(+raw.buffer) ? +raw.buffer : d.buffer,
    steps: cleanSteps(raw.steps, d.steps, counter),
  };
}

// Типові кроки попередньої версії: якщо їх не змінювали — замінюємо новими (перелік речей тепер у «Вихід без забутого»).
const V2_STEPS = [['Прокинутися', 5, 2], ['Гігієна', 15, 7], ['Сніданок і вода', 15, 3], ['Особисті речі', 10, 5], ['Документи, телефон, заряд', 5, 5], ['Перевірка завдань', 5, 1], ['Одягнутися й вийти', 5, 5]];
const isV2Default = (steps) => Array.isArray(steps) && steps.length === V2_STEPS.length
  && steps.every((s, i) => plain(s) && s.title === V2_STEPS[i][0] && +s.min === V2_STEPS[i][1] && +s.short === V2_STEPS[i][2]);

function cleanEss(list) {
  if (!Array.isArray(list)) return ESS_DEFAULT.map((t) => ({ id: uid(), t }));
  const out = [];
  const ids = new Set();
  for (const e of list.slice(0, 15)) {
    const t = plain(e) ? str(e.t, 60).trim() : '';
    if (!t) continue;
    let id = cleanId(e.id);
    if (ids.has(id)) id = uid();
    ids.add(id);
    out.push({ id, t });
  }
  return out;
}

function cleanMorning(rm, keepSteps, counter) {
  const d = defaultMorning();
  if (!plain(rm)) return d;
  if (Array.isArray(rm.templates)) {
    const templates = [];
    for (const t of rm.templates.slice(0, 20)) {
      if (!plain(t)) continue;
      const kind = BUILTIN_TPL.includes(t.kind) && t.id === `tpl-${t.kind}` ? t.kind : 'custom';
      const c = cleanTpl(t, kind, counter);
      if (!c || templates.some((x) => x.id === c.id)) continue;
      if (kind === 'custom' && templates.filter((x) => x.kind === 'custom').length >= TPL_CUSTOM_MAX) continue;
      templates.push(c);
    }
    for (const k of BUILTIN_TPL) if (!templates.some((t) => t.id === `tpl-${k}`)) templates.push(defaultTemplate(k));
    const order = (t) => (t.kind === 'custom' ? 99 : BUILTIN_TPL.indexOf(t.kind));
    templates.sort((a, b) => order(a) - order(b));
    return { active: templates.some((t) => t.id === rm.active) ? rm.active : 'tpl-work', templates, essentials: cleanEss(rm.essentials) };
  }
  // Версії 1–2: один ранковий план → шаблон «Робочий день».
  const work = cleanTpl({ ...rm, name: TPL_KIND.work.name }, 'work', counter);
  if (!keepSteps && isV2Default(rm.steps)) work.steps = defaultSteps('work');
  return { active: 'tpl-work', templates: [work, ...BUILTIN_TPL.slice(1).map(defaultTemplate)], essentials: cleanEss(rm.essentials) };
}

// Приводить будь-які збережені або імпортовані дані (схем 1–3) до схеми 3 без втрат.
export function cleanState(raw, nowMs = Date.now()) {
  const d = defaultState();
  if (!plain(raw)) return { state: d, dropped: 0, from: 0 };
  const counter = { dropped: 0 };
  const today = todayKey(nowMs);
  const from = int(raw.v, 0, 99, 0);

  const settings = cleanSettings(raw.settings);
  // Основна тема — Obsidian (темна). Типове «як у системі» з v1 переводимо на неї.
  if (from === 1 && settings.theme === 'auto') settings.theme = 'dark';
  // Хто вже користувався застосунком, вітального екрана не бачить.
  if (from >= 1 && from < SCHEMA) settings.onboarded = true;

  const rs = raw.session;
  const hasSession = plain(rs) && isKey(rs.date) && !!stamp(rs.startedAt);
  const morning = cleanMorning(raw.morning, hasSession, counter);

  let session = null;
  if (hasSession) {
    const done = {}, skipped = {}, checks = {}, ess = {};
    if (plain(rs.done)) for (const [k, v] of Object.entries(rs.done)) if (stamp(v)) done[k] = stamp(v);
    if (plain(rs.skipped)) for (const [k, v] of Object.entries(rs.skipped)) if (v === true || markAt(v)) skipped[k] = markAt(v) || true;
    if (plain(rs.checks)) for (const [k, v] of Object.entries(rs.checks)) if (Array.isArray(v)) checks[k] = v.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < 12);
    if (plain(rs.ess)) for (const [k, v] of Object.entries(rs.ess)) if (stamp(v)) ess[k] = stamp(v);
    const tpl = morning.templates.some((t) => t.id === rs.tpl) ? rs.tpl : morning.active;
    session = { date: rs.date, tpl, startedAt: stamp(rs.startedAt), done, skipped, checks, short: rs.short === true, finishedAt: stamp(rs.finishedAt), ess };
  }

  const seen = new Set();
  const take = (x) => {
    const title = plain(x) ? str(x.title, 300).trim() : '';
    if (!title) { counter.dropped++; return null; }
    let id = cleanId(x.id);
    if (seen.has(id)) id = uid();
    seen.add(id);
    return { id, title, note: str(x.note, 2000), createdAt: stamp(x.createdAt) || nowMs, doneAt: stamp(x.doneAt), cancelledAt: stamp(x.cancelledAt) };
  };
  const tasks = [];
  for (const x of Array.isArray(raw.tasks) ? raw.tasks.slice(0, 4000) : []) {
    const b = take(x);
    if (!b) continue;
    const due = x.due === '' && from >= 3 ? '' : isKey(x.due) ? x.due : today;
    const time = due ? parseHM(x.time) : null;
    const sub = [];
    for (const s of Array.isArray(x.sub) ? x.sub.slice(0, 30) : []) {
      const t = plain(s) ? str(s.t, 120).trim() : '';
      if (t) sub.push({ id: cleanId(s.id), t, d: stamp(s.d) });
    }
    tasks.push({
      ...b,
      pr: int(x.pr, 1, 3, 2),
      due,
      time: time == null ? '' : fmtHM(time),
      deadline: isKey(x.deadline) ? x.deadline : '',
      cat: TCAT[x.cat] ? x.cat : CAT_V2[x.cat] || '',
      sub,
      rep: cleanRep(x.rep, due),
      sid: okId(x.sid) ? x.sid : b.id,
      next: okId(x.next) ? x.next : '',
      moved: int(x.moved, 0, 999, 0),
    });
  }
  const musts = [];
  for (const x of Array.isArray(raw.musts) ? raw.musts.slice(0, 2000) : []) {
    const b = take(x);
    if (b) musts.push({ ...b, deadline: isKey(x.deadline) ? x.deadline : '', returnOn: isKey(x.returnOn) ? x.returnOn : '', moved: int(x.moved, 0, 999, 0) });
  }

  const pin = plain(raw.pin) && okId(raw.pin.id) && isKey(raw.pin.date) ? { id: raw.pin.id, date: raw.pin.date } : { id: '', date: '' };
  const pick = plain(raw.pick) && typeof raw.pick.key === 'string' && raw.pick.key.length <= 100 && isKey(raw.pick.date) ? { key: raw.pick.key, date: raw.pick.date } : { key: '', date: '' };
  const laterMap = {};
  if (plain(raw.later)) for (const [k, v] of Object.entries(raw.later).slice(0, 300)) if (typeof k === 'string' && k.length <= 100 && Number.isFinite(+v) && +v > 0) laterMap[k] = +v;
  const rf = raw.focus;
  const focus = plain(rf) && okId(rf.id) && stamp(rf.start) ? { id: rf.id, start: stamp(rf.start), mins: int(rf.mins, 1, 180, 25) } : null;
  const days = {};
  if (plain(raw.days)) {
    for (const [k, v] of Object.entries(raw.days).sort(([a], [b]) => cmpKey(a, b)).slice(-90)) {
      if (isKey(k) && plain(v) && stamp(v.at)) days[k] = { at: stamp(v.at), done: int(v.done, 0, 9999, 0), moved: int(v.moved, 0, 9999, 0) };
    }
  }

  return {
    state: {
      v: SCHEMA, updatedAt: stamp(raw.updatedAt), settings, morning, session, tasks, musts, pin, pick, later: laterMap,
      gear: cleanGear(raw.gear, nowMs),
      deck: cleanDeck(raw.deck),
      tools: cleanTools(raw.tools),
      focus,
      days,
    },
    dropped: counter.dropped,
    from,
  };
}

export function overview(s) {
  const items = Object.values(s.gear.cats).reduce((n, c) => n + c.items.length, 0);
  const tpl = currentTpl(s);
  return {
    tasks: s.tasks.filter(isOpen).length,
    tasksDone: s.tasks.filter((t) => !isOpen(t)).length,
    musts: s.musts.filter(isOpen).length,
    steps: tpl.steps.length,
    templates: s.morning.templates.length,
    arrival: tpl.arrival,
    items,
    checks: s.gear.history.length,
    scenarios: s.deck.scenarios.length,
    tools: s.tools.length,
  };
}

export function makeBackup(state, nowMs = Date.now()) {
  return { app: 'opora', kind: 'backup', v: SCHEMA, exportedAt: nowMs, data: { ...state, session: null, focus: null, deck: { ...state.deck, active: null } } };
}

export function readBackup(obj, nowMs = Date.now()) {
  if (!plain(obj)) return { ok: false, error: 'Файл не схожий на резервну копію ОПОРА.' };
  if (obj.app !== 'opora' || obj.kind !== 'backup' || !plain(obj.data)) return { ok: false, error: 'Це не резервна копія ОПОРА.' };
  if (!(+obj.v >= 1)) return { ok: false, error: 'Невідома версія резервної копії.' };
  if (+obj.v > SCHEMA) return { ok: false, error: 'Копію створено новішою версією застосунку. Спершу оновіть застосунок.' };
  const { state, dropped } = cleanState({ ...obj.data, v: +obj.v }, nowMs);
  return { ok: true, state, dropped, from: +obj.v, exportedAt: stamp(obj.exportedAt), summary: overview(state) };
}
