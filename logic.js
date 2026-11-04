// ОПОРА 365 — основна логіка без DOM: ранок, справи, режими, наступна дія, дані.
// Модуль використовують і застосунок, і тести (tests.js).
import {
  DAY, parseHM, fmtHM, fmtDur, todayKey, dayNum, dateFromNum, addDays, diffDays, isKey,
  localMin, minOfDay, keyOfLocal, localAt, weekday, shortDate, plural, count, daysWord, relIn, uid, WD_S,
} from './time.js';
import { defaultGear, cleanGear, gearSummary, checkProgress, CAT as GCAT } from './logic-gear.js';
import { defaultDeck, cleanDeck, defaultTools, cleanTools, runProgress } from './logic-deck.js';

export * from './time.js';

export const SCHEMA = 2;
export const GRACE = 120; // скільки хвилин після часу виходу план ще вважається «сьогоднішнім»

export const PRIORITIES = [
  { id: 1, name: 'Обовʼязково сьогодні', short: 'Обовʼязково', tone: 'coral' },
  { id: 2, name: 'Важливо', short: 'Важливо', tone: 'amber' },
  { id: 3, name: 'Можна пізніше', short: 'Пізніше', tone: 'slate' },
];
export const PR = Object.fromEntries(PRIORITIES.map((p) => [p.id, p]));
export const TRANSPORT = [
  { id: 'bus', name: 'Автобус' },
  { id: 'car', name: 'Авто' },
  { id: 'taxi', name: 'Таксі' },
  { id: 'walk', name: 'Пішки' },
];
export const BUFFERS = [10, 15, 20];
export const TASK_CATS = [
  { id: 'work', name: 'Служба', icon: 'briefcase' },
  { id: 'docs', name: 'Документи', icon: 'file' },
  { id: 'train', name: 'Заняття', icon: 'book' },
  { id: 'home', name: 'Дім', icon: 'home' },
  { id: 'self', name: 'Особисте', icon: 'user' },
  { id: 'buy', name: 'Покупки', icon: 'bag' },
  { id: 'health', name: 'Здоровʼя', icon: 'heart' },
];
export const TCAT = Object.fromEntries(TASK_CATS.map((c) => [c.id, c]));
export const MODES = [
  { id: 'morning', name: 'Ранок', icon: 'sunrise', tone: 'amber', hint: 'Підготовка і вихід' },
  { id: 'day', name: 'Сьогодні', icon: 'sun', tone: 'blue', hint: 'Справи за пріоритетами' },
  { id: 'ready', name: 'Готовність', icon: 'shieldCheck', tone: 'teal', hint: 'Екіпірування і сценарії' },
  { id: 'rest', name: 'Відпочинок', icon: 'moon', tone: 'moon', hint: 'Лише важливе й план на завтра' },
];
export const MODE = Object.fromEntries(MODES.map((m) => [m.id, m]));
export const REPEATS = [
  { id: '', name: 'Не повторювати' },
  { id: 'daily', name: 'Щодня' },
  { id: 'weekdays', name: 'Пн–Пт' },
  { id: 'weekly', name: 'Щотижня' },
  { id: 'monthly', name: 'Щомісяця' },
];

/* ---------- Стан за замовчуванням ---------- */

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
export function defaultSettings() {
  return { theme: 'dark', lastBackupAt: 0, installHint: true, name: '', mode: { id: 'auto', until: 0 }, restAt: '21:00', haptics: true };
}
export function defaultState() {
  return {
    v: SCHEMA,
    updatedAt: 0,
    settings: defaultSettings(),
    morning: { arrival: '08:30', transport: 'bus', travel: { bus: 40, car: 25, taxi: 20, walk: 35 }, buffer: 15, steps: defaultSteps() },
    session: null,
    tasks: [],
    musts: [],
    pin: { id: '', date: '' },
    later: {},
    gear: defaultGear(),
    deck: defaultDeck(),
    tools: defaultTools(),
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
    index: main.current ? counted.findIndex((r) => r.id === main.current.id) + 1 : counted.length,
  };
}

// Короткий підсумок ранку для головного екрана.
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

/* ---------- Справи ---------- */

export const normTitle = (s) => String(s).toLowerCase().replace(/[’'ʼ`"«».,!?;:()\-–—]/g, ' ').replace(/\s+/g, ' ').trim();

export function findDuplicate(list, title, exceptId = '') {
  const n = normTitle(title);
  return n ? list.find((t) => !t.doneAt && t.id !== exceptId && normTitle(t.title) === n) || null : null;
}

export function newTask(title, pr, due, nowMs = Date.now(), extra = {}) {
  const id = uid();
  return {
    id, title: String(title).trim().slice(0, 300), pr, due, time: '', cat: '', note: '', sub: [], rep: null, sid: id, next: '',
    createdAt: nowMs, doneAt: 0, moved: 0, ...extra,
  };
}

// Перенесення на наступний день: та сама справа, без копії.
export function postpone(task, today) {
  const base = task.due > today ? task.due : today;
  return { ...task, due: addDays(base, 1), moved: (task.moved || 0) + 1 };
}

const cmpKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const timeOrder = (t) => (t.time ? parseHM(t.time) ?? DAY : DAY);
export const byTask = (a, b) => a.pr - b.pr || cmpKey(a.due, b.due) || timeOrder(a) - timeOrder(b) || a.createdAt - b.createdAt;

export function taskView(tasks, today, pin = null) {
  const open = tasks.filter((t) => !t.doneAt);
  const overdue = open.filter((t) => t.due < today).sort(byTask);
  const todays = open.filter((t) => t.due === today).sort(byTask);
  const upcoming = open.filter((t) => t.due > today).sort((a, b) => cmpKey(a.due, b.due) || a.pr - b.pr || timeOrder(a) - timeOrder(b) || a.createdAt - b.createdAt);
  const doneToday = tasks.filter((t) => t.doneAt && todayKey(t.doneAt) === today).sort((a, b) => b.doneAt - a.doneAt);
  const ordered = [...overdue, ...todays].sort(byTask);
  let main = ordered[0] || null;
  if (pin && pin.date === today) {
    const p = ordered.find((t) => t.id === pin.id);
    if (p) main = p;
  }
  const rest = ordered.filter((t) => t !== main);
  return {
    overdue, today: todays, upcoming, doneToday, ordered,
    main, top: rest.slice(0, 3), more: rest.slice(3),
    focus: ordered.slice(0, 3),
    groups: PRIORITIES.map((p) => ({ ...p, items: todays.filter((t) => t.pr === p.id) })),
    openCount: ordered.length,
  };
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
  if (k === 'daily' || k === 'weekdays') return { k };
  if (k === 'weekly') return { k, days: days.length ? [...new Set(days)].filter((d) => d >= 0 && d <= 6).sort() : [weekday(due)] };
  if (k === 'monthly') return { k, dom: +due.slice(8) };
  return null;
}

// Виконати справу. Для повторюваної — створюється наступна, якщо її ще немає.
export function completeTask(state, id, nowMs = Date.now()) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t || t.doneAt) return null;
  t.doneAt = nowMs;
  let spawned = null;
  if (t.rep) {
    const exists = state.tasks.some((x) => !x.doneAt && x.sid === t.sid && x.id !== t.id);
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
    if (n && !n.doneAt && !n.moved) state.tasks = state.tasks.filter((x) => x !== n);
    t.next = '';
  }
}

export function subProgress(t) {
  const done = t.sub.filter((s) => s.d).length;
  return { done, total: t.sub.length, next: t.sub.find((s) => !s.d) || null };
}

// Шкала дедлайну: яка частка часу до строку вже минула (реальні дані, не прикраса).
export function deadlineInfo(item, nowMs = Date.now(), kind = 'task') {
  const now = localMin(nowMs);
  const today = keyOfLocal(now);
  if (item.doneAt) return null;
  const created = localMin(item.createdAt || nowMs);
  if (kind === 'must') {
    if (!item.deadline) return null;
    const end = localAt(item.deadline, DAY);
    const left = diffDays(today, item.deadline);
    const frac = Math.min(1, Math.max(0, (now - created) / Math.max(1, end - created)));
    if (left < 0) return { frac: 1, level: 'late', text: `строк минув ${daysWord(-left)} тому` };
    if (left === 0) return { frac, level: 'soon', text: 'строк — сьогодні' };
    if (left === 1) return { frac, level: 'soon', text: 'строк — завтра' };
    return { frac, level: 'normal', text: `до ${shortDate(item.deadline, today)} · ще ${daysWord(left)}` };
  }
  if (item.due < today) {
    const n = diffDays(item.due, today);
    return { frac: 1, level: 'late', text: n === 1 ? 'прострочено з учора' : `прострочено ${daysWord(n)}` };
  }
  if (item.due > today) return null;
  const at = item.time ? localAt(today, parseHM(item.time)) : localAt(today, DAY);
  const start = Math.min(Math.max(created, localAt(today, 0)), at - 1);
  const frac = Math.min(1, Math.max(0, (now - start) / Math.max(1, at - start)));
  if (item.time) {
    if (now > at) return { frac: 1, level: 'late', text: `мало бути о ${item.time}` };
    return { frac, level: at - now <= 60 ? 'soon' : 'normal', text: `о ${item.time} · ${relIn(at - now)}`, at };
  }
  return { frac, level: frac > 0.8 ? 'soon' : 'normal', text: 'до кінця дня' };
}

/* ---------- Обовʼязкові справи (не зникають до виконання) ---------- */

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

/* ---------- Наступна дія ---------- */

const ORDER_MAX = 1e12;

// Усі кандидати на «Твою наступну дію» з причиною пріоритетності. Лише реальні дані.
export function candidates(state, nowMs = Date.now(), modeId = '') {
  const now = localMin(nowMs);
  const today = keyOfLocal(now);
  const mode = modeId || modeInfo(state, nowMs).id;
  const out = [];
  const free = (key) => !isDeferred(state, key, nowMs);

  // Ранок
  const sm = morningSummary(state, nowMs);
  if (sm.phase === 'running') {
    const st = sessionStatus(state, sm.session, nowMs);
    const c = st.current;
    if (c) {
      const reason = st.level === 'ok' ? `Ранок · крок ${st.index} із ${st.count} · вихід о ${fmtHM(st.plan.departure)}`
        : st.level === 'tight' ? `Часу обмаль: бракує ${fmtDur(-st.spare)}` : `Пізніше на ${fmtDur(-st.spare)} · вихід о ${fmtHM(st.plan.departure)}`;
      out.push({ key: `step:${c.id}`, kind: 'step', id: c.id, rank: 10, title: c.title, reason, at: c.eta + c.left, level: st.level === 'ok' ? 'normal' : 'warn', critical: c.critical, blocked: c.items.length > 0, icon: 'sunrise', defer: false });
    }
  } else if (sm.rel === 0 && mode !== 'rest' && (sm.phase === 'window' || (sm.phase === 'before' && mode === 'morning' && sm.toWake <= 60))) {
    const key = `morning:${sm.date}`;
    if (free(key)) {
      out.push({
        key, kind: 'morning', rank: mode === 'morning' ? 12 : 25, title: 'Почати ранкову підготовку',
        reason: sm.phase === 'window' ? `Вихід о ${fmtHM(sm.plan.departure)} · ${relIn(sm.toDep)}` : `Підйом о ${fmtHM(sm.plan.wake)} · ${relIn(sm.toWake)}`,
        at: sm.depAt, level: sm.phase === 'window' ? 'warn' : 'normal', icon: 'sunrise', defer: true,
      });
    }
  }

  // Розпочаті перевірки та сценарії
  for (const cat of Object.keys(state.gear.active)) {
    const key = `gearrun:${cat}`;
    if (!free(key)) continue;
    const pr = checkProgress(state.gear, cat);
    out.push({ key, kind: 'gearRun', cat, rank: mode === 'ready' ? 13 : 40, title: `Завершити перевірку: ${GCAT[cat].name}`, reason: `Перевірка триває · позначено ${pr.marked} з ${pr.total}`, level: 'normal', icon: GCAT[cat].icon, defer: true });
  }
  const run = state.deck.active;
  if (run && free(`deckrun:${run.id}`)) {
    const sc = state.deck.scenarios.find((s) => s.id === run.sid);
    const pr = runProgress(run, sc);
    out.push({ key: `deckrun:${run.id}`, kind: 'deckRun', id: run.id, rank: mode === 'ready' ? 14 : mode === 'rest' ? 40 : 15, title: `Продовжити: ${run.title}`, reason: `Сценарій триває · ${pr.done} з ${pr.total} кроків`, level: 'normal', icon: 'play', defer: true });
  }

  // Справи
  const tv = taskView(state.tasks, today, state.pin);
  for (const t of tv.ordered) {
    const key = `task:${t.id}`;
    if (!free(key)) continue;
    const overdue = t.due < today;
    const at = t.time && t.due === today ? localAt(today, parseHM(t.time)) : null;
    const pinned = tv.main === t && state.pin.date === today && state.pin.id === t.id;
    let rank;
    if (at != null && at - now <= 60) rank = 18;
    else if (pinned) rank = mode === 'rest' ? 31 : 19;
    else if (mode === 'rest') rank = t.pr === 1 ? (overdue ? 31 : 32) : 60 + t.pr;
    else rank = t.pr === 1 ? (overdue ? 22 : 24) : 26 + t.pr * 2 - (overdue ? 1 : 0);
    const parts = [PR[t.pr].name];
    if (pinned) parts[0] = 'Головне на сьогодні';
    if (overdue) parts.push(diffDays(t.due, today) === 1 ? 'прострочено з учора' : `прострочено з ${shortDate(t.due, today)}`);
    if (at != null) parts.push(at < now ? `мало бути о ${t.time}` : `о ${t.time} · ${relIn(at - now)}`);
    const sp = subProgress(t);
    if (sp.total) parts.push(`кроків ${sp.done} з ${sp.total}`);
    out.push({ key, kind: 'task', id: t.id, rank, order: [t.pr, dayNum(t.due), at ?? ORDER_MAX, t.createdAt], title: t.title, reason: parts.join(' · '), at, level: overdue || (at != null && at < now) ? 'warn' : 'normal', icon: t.cat ? TCAT[t.cat].icon : 'list', pr: t.pr, defer: true });
  }

  // Обовʼязкові
  const mv = mustView(state.musts, today);
  for (const m of mv.open) {
    const key = `must:${m.id}`;
    if (!free(key)) continue;
    let rank, reason;
    if (m.left !== null && m.left < 0) { rank = mode === 'rest' ? 30 : 20; reason = `Обовʼязкова · строк минув ${daysWord(-m.left)} тому`; }
    else if (m.left === 0) { rank = mode === 'rest' ? 30 : 20; reason = 'Обовʼязкова · строк сьогодні'; }
    else if (m.left === 1) { rank = 27; reason = 'Обовʼязкова · строк завтра'; }
    else { rank = mode === 'rest' ? 62 : 29; reason = m.age ? `Обовʼязкова · у списку ${daysWord(m.age)}` : 'Обовʼязкова · додано сьогодні'; }
    out.push({ key, kind: 'must', id: m.id, rank, order: [m.left ?? 1e6, m.createdAt], title: m.title, reason, level: m.left !== null && m.left <= 0 ? 'warn' : 'normal', icon: 'pin', defer: true });
  }

  // Екіпірування
  const RANKS = { issues: { ready: 15, day: 33, morning: 50, rest: 34 }, needs: { ready: 16, day: 36, morning: 52, rest: 35 } };
  for (const c of gearSummary(state.gear, nowMs).cats) {
    const s = c.st.s;
    if ((s !== 'issues' && s !== 'needs') || c.st.reason === 'empty') continue;
    const key = `gear:${c.id}`;
    if (!free(key)) continue;
    out.push({ key, kind: 'gear', cat: c.id, rank: RANKS[s][mode], title: s === 'issues' ? `Усунути недоліки: ${c.name}` : `Перевірити: ${c.name}`, reason: c.st.text, level: s === 'issues' ? 'warn' : 'normal', icon: c.icon, defer: true });
  }

  // Вечір: план на завтра
  if (mode === 'rest') {
    const p = computePlan(state.morning);
    const key = `plan:${addDays(today, 1)}`;
    if (free(key)) out.push({ key, kind: 'plan', rank: 70, title: 'Переглянути план на завтра', reason: `Підйом о ${fmtHM(p.wake)} · вихід о ${fmtHM(p.departure)}`, level: 'normal', icon: 'moon', defer: true });
  }

  // Резервна копія
  const hasData = state.tasks.length + state.musts.length + state.gear.history.length > 0;
  const lb = state.settings.lastBackupAt;
  const stale = !lb || diffDays(todayKey(lb), today) > 7;
  if (hasData && stale && (mode === 'day' || mode === 'rest') && free('backup')) {
    out.push({ key: 'backup', kind: 'backup', rank: 80, title: 'Створити резервну копію', reason: lb ? `Остання копія ${daysWord(diffDays(todayKey(lb), today))} тому` : 'Копій ще не було', level: 'normal', icon: 'share', defer: true });
  }

  out.sort((a, b) => a.rank - b.rank || cmpArr(a.order, b.order));
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

/* ---------- Хронологія дня ---------- */

export function dayEvents(state, nowMs = Date.now()) {
  const now = localMin(nowMs);
  const today = keyOfLocal(now);
  const base = dayNum(today) * DAY;
  const events = [];
  const p = computePlan(state.morning);
  const sm = morningSummary(state, nowMs);
  const morningDone = sm.session && sm.session.date === today && !!sm.session.finishedAt;
  if (!p.wakePrevDay) events.push({ t: base + p.wake, kind: 'wake', title: 'Підйом', done: morningDone || now > base + p.wake });
  if (p.departure >= 0) events.push({ t: base + p.departure, kind: 'dep', title: 'Вихід', done: now > base + p.departure });
  if (p.arrival < DAY) events.push({ t: base + p.arrival, kind: 'arr', title: 'Прибуття', done: now > base + p.arrival });
  for (const t of state.tasks) {
    if (t.due !== today || !t.time) continue;
    const m = parseHM(t.time);
    if (m == null) continue;
    events.push({ t: base + m, kind: 'task', title: t.title, id: t.id, done: !!t.doneAt, pr: t.pr });
  }
  events.sort((a, b) => a.t - b.t || (a.kind === 'task') - (b.kind === 'task'));
  const first = events.length ? events[0].t : now;
  const last = events.length ? events[events.length - 1].t : now;
  const start = Math.floor((Math.min(first, now) - 30) / 60) * 60;
  const end = Math.ceil((Math.max(last, now) + 30) / 60) * 60;
  return { events, now, start: Math.max(start, base), end: Math.min(Math.max(end, start + 240), base + DAY), base };
}

/* ---------- Day Orb і підсумок дня ---------- */

export function orbData(state, nowMs = Date.now(), modeId = '') {
  const now = localMin(nowMs);
  const today = keyOfLocal(now);
  const mode = modeId || modeInfo(state, nowMs).id;
  if (mode === 'morning') {
    const sm = morningSummary(state, nowMs);
    if (sm.session) {
      const st = sessionStatus(state, sm.session, nowMs);
      const rows = st.rows.filter((r) => r.state !== 'auto');
      return {
        mode, value: st.doneCount, total: st.count, big: `${st.doneCount}/${st.count}`, caption: 'кроків ранку',
        sub: st.finished ? 'Готові до виходу' : `Вихід о ${fmtHM(st.plan.departure)}`,
        level: st.finished ? 'ok' : st.level === 'ok' ? 'normal' : 'warn',
        segs: rows.map((r) => (r.state === 'done' || r.state === 'skipped' ? 'done' : st.current && r.id === st.current.id ? 'current' : 'todo')),
      };
    }
    const n = state.morning.steps.length;
    return {
      mode, value: 0, total: n, big: fmtHM(sm.plan.departure), caption: sm.rel === 0 ? 'час виходу' : 'вихід завтра',
      sub: `Підйом о ${fmtHM(sm.plan.wake)}`, level: sm.phase === 'window' ? 'warn' : 'normal', segs: Array(n).fill('todo'), isTime: true,
    };
  }
  if (mode === 'ready') {
    const gs = gearSummary(state.gear, nowMs);
    const bad = gs.cats.filter((c) => c.st.s === 'issues');
    let sub = 'Усі перевірки актуальні';
    if (bad.length) sub = `Недоліки: ${bad.map((c) => c.short).join(', ')}`;
    else if (gs.running) sub = 'Перевірка триває';
    else if (gs.needs) sub = `Потребують перевірки: ${gs.needs}`;
    return { mode, value: gs.ok, total: gs.total, big: `${gs.ok}/${gs.total}`, caption: 'без недоліків', sub, level: bad.length ? 'warn' : 'normal', segs: gs.cats.map((c) => c.st.s), gear: true };
  }
  const tv = taskView(state.tasks, today);
  const done = tv.doneToday.length, open = tv.openCount, total = done + open;
  if (mode === 'rest') {
    const p = computePlan(state.morning);
    return { mode, value: done, total: Math.max(total, 1), big: String(done), caption: plural(done, ['справу виконано', 'справи виконано', 'справ виконано']), sub: `Завтра підйом о ${fmtHM(p.wake)}`, level: 'normal', segs: null };
  }
  const nextEv = dayEvents(state, nowMs).events.find((e) => e.t > now && !e.done);
  const segs = total && total <= 16 ? [...Array(done).fill('done'), ...Array(tv.overdue.length).fill('late'), ...Array(tv.today.length).fill('todo')] : null;
  return {
    mode, value: done, total, big: total ? `${done}/${total}` : '0', caption: total ? 'справ виконано' : 'справ на сьогодні немає',
    sub: nextEv ? `${fmtHM(nextEv.t)} · ${nextEv.title}` : open ? `Залишилось ${open}` : total ? 'Усе виконано' : '',
    level: tv.overdue.length ? 'warn' : 'normal', segs,
  };
}

export function daySummary(state, nowMs = Date.now()) {
  const today = todayKey(nowMs);
  const tv = taskView(state.tasks, today);
  const mv = mustView(state.musts, today);
  const gs = gearSummary(state.gear, nowMs);
  const parts = [];
  if (tv.openCount) parts.push(count(tv.openCount, ['справа', 'справи', 'справ']));
  if (tv.overdue.length) parts.push(`прострочено ${tv.overdue.length}`);
  if (mv.open.length) parts.push(count(mv.open.length, ['обовʼязкова', 'обовʼязкові', 'обовʼязкових']));
  if (gs.issues) parts.push(count(gs.issues, ['категорія з недоліками', 'категорії з недоліками', 'категорій з недоліками']));
  else if (gs.needs) parts.push(count(gs.needs, ['перевірка потрібна', 'перевірки потрібні', 'перевірок потрібно']));
  if (!parts.length) return tv.doneToday.length ? 'Усе на сьогодні виконано' : 'Справ на сьогодні немає';
  return parts.join(' · ');
}

/* ---------- Очищення застарілого ---------- */

// Виконане старше 30 днів прибираємо, щоб сховище не росло.
export function purge(state, nowMs = Date.now()) {
  const cut = nowMs - 30 * 864e5;
  state.tasks = state.tasks.filter((t) => !t.doneAt || t.doneAt > cut);
  state.musts = state.musts.filter((m) => !m.doneAt || m.doneAt > cut);
  if (state.later) {
    const now = localMin(nowMs);
    for (const [k, v] of Object.entries(state.later)) if (!(v > now)) delete state.later[k];
  }
  if (state.pin && state.pin.date && state.pin.date !== todayKey(nowMs)) state.pin = { id: '', date: '' };
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
  if (!plain(r)) return null;
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
  };
}

// Приводить будь-які збережені або імпортовані дані (зокрема схеми v1) до схеми v2.
export function cleanState(raw, nowMs = Date.now()) {
  const d = defaultState();
  if (!plain(raw)) return { state: d, dropped: 0, from: 0 };
  let dropped = 0;
  const today = todayKey(nowMs);
  const from = int(raw.v, 0, 99, 0);

  const settings = cleanSettings(raw.settings);
  // Основна тема нової версії — Obsidian (темна). Типове «як у системі» з v1 переводимо на неї.
  if (from === 1 && settings.theme === 'auto') settings.theme = 'dark';

  const rm = plain(raw.morning) ? raw.morning : {};
  const arr = parseHM(rm.arrival);
  const travel = {};
  for (const t of TRANSPORT) travel[t.id] = int(rm.travel?.[t.id], 0, 600, d.morning.travel[t.id]);
  let steps = d.morning.steps;
  if (Array.isArray(rm.steps)) {
    const ids = new Set();
    steps = [];
    for (const s of rm.steps.slice(0, 40)) {
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
  for (const x of Array.isArray(raw.tasks) ? raw.tasks.slice(0, 2000) : []) {
    const b = take(x);
    if (!b) continue;
    const due = isKey(x.due) ? x.due : today;
    const time = parseHM(x.time);
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
      cat: TCAT[x.cat] ? x.cat : '',
      sub,
      rep: cleanRep(x.rep, due),
      sid: okId(x.sid) ? x.sid : b.id,
      next: okId(x.next) ? x.next : '',
      moved: int(x.moved, 0, 999, 0),
    });
  }
  const musts = [];
  for (const x of Array.isArray(raw.musts) ? raw.musts.slice(0, 1000) : []) {
    const b = take(x);
    if (b) musts.push({ ...b, deadline: isKey(x.deadline) ? x.deadline : '' });
  }

  const pin = plain(raw.pin) && okId(raw.pin.id) && isKey(raw.pin.date) ? { id: raw.pin.id, date: raw.pin.date } : { id: '', date: '' };
  const laterMap = {};
  if (plain(raw.later)) for (const [k, v] of Object.entries(raw.later).slice(0, 300)) if (typeof k === 'string' && k.length <= 100 && Number.isFinite(+v) && +v > 0) laterMap[k] = +v;

  return {
    state: {
      v: SCHEMA, updatedAt: stamp(raw.updatedAt), settings, morning, session, tasks, musts, pin, later: laterMap,
      gear: cleanGear(raw.gear, nowMs),
      deck: cleanDeck(raw.deck),
      tools: cleanTools(raw.tools),
    },
    dropped,
    from,
  };
}

export function overview(s) {
  const items = Object.values(s.gear.cats).reduce((n, c) => n + c.items.length, 0);
  return {
    tasks: s.tasks.filter((t) => !t.doneAt).length,
    tasksDone: s.tasks.filter((t) => t.doneAt).length,
    musts: s.musts.filter((m) => !m.doneAt).length,
    steps: s.morning.steps.length,
    arrival: s.morning.arrival,
    items,
    checks: s.gear.history.length,
    scenarios: s.deck.scenarios.length,
    tools: s.tools.length,
  };
}

export function makeBackup(state, nowMs = Date.now()) {
  return { app: 'opora', kind: 'backup', v: SCHEMA, exportedAt: nowMs, data: { ...state, session: null, deck: { ...state.deck, active: null } } };
}

export function readBackup(obj, nowMs = Date.now()) {
  if (!plain(obj)) return { ok: false, error: 'Файл не схожий на резервну копію ОПОРА.' };
  if (obj.app !== 'opora' || obj.kind !== 'backup' || !plain(obj.data)) return { ok: false, error: 'Це не резервна копія ОПОРА.' };
  if (!(+obj.v >= 1)) return { ok: false, error: 'Невідома версія резервної копії.' };
  if (+obj.v > SCHEMA) return { ok: false, error: 'Копію створено новішою версією застосунку. Спершу оновіть застосунок.' };
  const { state, dropped } = cleanState({ ...obj.data, v: +obj.v }, nowMs);
  return { ok: true, state, dropped, from: +obj.v, exportedAt: stamp(obj.exportedAt), summary: overview(state) };
}
