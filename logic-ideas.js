// ОПОРА 365 — «Задуми»: творчі й фінансові ідеї. Записуйте все, у роботі — одна, щодня — маленький крок.
// Лише реальні позначки: що записано, які кроки зроблено, у які дні, коли задум відвантажено.
import { uid, todayKey, addDays, isKey, localMin, minOfDay, parseHM, fmtHM, dayNum } from './time.js';

export const IDEA_KINDS = {
  create: { id: 'create', name: 'Творча', lead: 'Творчий задум', icon: 'spark', tone: 'violet' },
  money: { id: 'money', name: 'Фінансова', lead: 'Фінансовий задум', icon: 'wallet', tone: 'amber' },
};
export const IDEAS_MAX = 300;
const STEPS_MAX = 60;
const LOG_MAX = 120;
export const SLOT_MINS = [15, 25, 45];

// Принципи — нашими словами: фокус, маленькі кроки, готове краще за ідеальне, досвід як сировина.
export const PRINCIPLES = [
  'Одна ідея в роботі. Решта чекає в скриньці — і це нормально.',
  'Маленький крок щодня сильніший за великий план колись.',
  'Готове краще за ідеальне. Покажіть першу версію.',
  'Записуйте все. Обирайте одне.',
  'Сказати «ні» зайвому — так зʼявляється час для свого.',
  'Найкращі ідеї — з вашого досвіду: робота, родина, захоплення.',
  'Фінансова ідея починається з першої гривні, а не з бізнес-плану.',
  'Не чекайте натхнення. Сядьте на 25 хвилин — воно прийде під час роботи.',
  'Простота — це коли прибрано все, без чого можна обійтися.',
];
export const principleOf = (day) => PRINCIPLES[((dayNum(day) % PRINCIPLES.length) + PRINCIPLES.length) % PRINCIPLES.length];

export function defaultIdeas() {
  return { list: [], focus: '', at: '20:00', min: 25, log: {}, timer: null };
}

export function newIdea(title, kind = 'create', nowMs = Date.now(), note = '') {
  return { id: uid(), title: String(title).trim().slice(0, 200), kind: IDEA_KINDS[kind] ? kind : 'create', note: String(note || '').slice(0, 2000), steps: [], createdAt: nowMs, doneAt: 0, parkedAt: 0 };
}

const isOpenIdea = (x) => !x.doneAt && !x.parkedAt;
export function ideaView(ideas) {
  const focus = ideas.list.find((x) => x.id === ideas.focus && isOpenIdea(x)) || null;
  return {
    focus,
    inbox: ideas.list.filter((x) => isOpenIdea(x) && x !== focus).sort((a, b) => b.createdAt - a.createdAt),
    shipped: ideas.list.filter((x) => x.doneAt).sort((a, b) => b.doneAt - a.doneAt),
    parked: ideas.list.filter((x) => !x.doneAt && x.parkedAt).sort((a, b) => b.parkedAt - a.parkedAt),
  };
}

// Нова ідея — на початок скриньки. Якщо в роботі нічого немає, вона одразу стає головним задумом.
export function addIdea(ideas, title, kind, nowMs = Date.now(), note = '') {
  const t = String(title || '').trim();
  if (!t || ideas.list.length >= IDEAS_MAX) return null;
  const x = newIdea(t, kind, nowMs, note);
  ideas.list.unshift(x);
  if (!ideaView(ideas).focus) ideas.focus = x.id;
  return x;
}

export const findIdea = (ideas, id) => ideas.list.find((x) => x.id === id) || null;
export const nextStep = (idea) => idea?.steps.find((s) => !s.doneAt) || null;

export function addStep(idea, text, nowMs = Date.now()) {
  const t = String(text || '').trim().slice(0, 160);
  if (!t || idea.steps.length >= STEPS_MAX) return null;
  const s = { id: uid(), t, doneAt: 0, at: nowMs };
  idea.steps.push(s);
  return s;
}

// День із кроком: зроблено крок або позначено «попрацював». Журнал — дата → скільки разів.
export function logDay(ideas, nowMs = Date.now()) {
  const day = todayKey(nowMs);
  ideas.log[day] = (ideas.log[day] || 0) + 1;
  const keys = Object.keys(ideas.log).sort();
  while (keys.length > LOG_MAX) delete ideas.log[keys.shift()];
  return day;
}
export function unlogDay(ideas, day) {
  if (!ideas.log[day]) return;
  if (ideas.log[day] > 1) ideas.log[day]--; else delete ideas.log[day];
}

export function doneStep(ideas, ideaId, stepId, nowMs = Date.now()) {
  const x = findIdea(ideas, ideaId);
  const s = x?.steps.find((y) => y.id === stepId);
  if (!s || s.doneAt) return null;
  s.doneAt = nowMs;
  logDay(ideas, nowMs);
  return s;
}

export function setFocus(ideas, id) {
  const x = findIdea(ideas, id);
  if (!x) return;
  x.parkedAt = 0;
  ideas.focus = id;
}

// Відвантажено: ідея стала результатом. Скільки днів від запису до результату й скільки кроків — справжні числа.
export function shipIdea(ideas, id, nowMs = Date.now()) {
  const x = findIdea(ideas, id);
  if (!x || x.doneAt) return null;
  x.doneAt = nowMs;
  if (ideas.focus === id) ideas.focus = '';
  return { days: Math.max(0, dayNum(todayKey(nowMs)) - dayNum(todayKey(x.createdAt))), steps: x.steps.filter((s) => s.doneAt).length };
}
export function parkIdea(ideas, id, nowMs = Date.now()) {
  const x = findIdea(ideas, id);
  if (!x) return;
  x.parkedAt = nowMs;
  if (ideas.focus === id) ideas.focus = '';
}
export function reopenIdea(ideas, id) {
  const x = findIdea(ideas, id);
  if (!x) return;
  x.doneAt = 0; x.parkedAt = 0;
}

export const stepToday = (ideas, nowMs = Date.now()) => !!ideas.log[todayKey(nowMs)];

// Час для задуму: від заданої хвилини до кінця доби, якщо сьогодні кроку ще не було.
export function ideaSlot(ideas, nowMs = Date.now()) {
  const at = ideas.at ? parseHM(ideas.at) : null;
  const now = minOfDay(localMin(nowMs));
  return { at, on: at != null, active: at != null && now >= at && !stepToday(ideas, nowMs) };
}

// Таймер задуму: { id, start, mins } → скільки лишилось.
export function ideaTimer(ideas, nowMs = Date.now()) {
  const t = ideas.timer;
  if (!t) return null;
  const end = t.start + t.mins * 60000;
  return { id: t.id, mins: t.mins, end, left: Math.max(0, Math.round((end - nowMs) / 1000)), over: nowMs >= end };
}

// Дні з кроком у періоді [from, to] і скільки днів можна було: від першої ідеї; сьогодні — лише якщо крок уже є.
export function ideaDays(ideas, from, to, today) {
  if (!ideas.list.length) return { n: 0, of: 0 };
  const since = todayKey(Math.min(...ideas.list.map((x) => x.createdAt)));
  let n = 0, of = 0;
  for (let k = from; k <= to; k = addDays(k, 1)) {
    if (k < since || k > today) continue;
    const has = !!ideas.log[k];
    if (k === today && !has) continue;
    of++; if (has) n++;
  }
  return { n, of };
}

const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
const stamp = (v) => (Number.isFinite(v) && v > 0 && v < 4102444800000 ? Math.round(v) : 0);
const okId = (v) => typeof v === 'string' && /^[\w-]{1,40}$/.test(v);

export function cleanIdeas(raw, nowMs = Date.now()) {
  const out = defaultIdeas();
  if (!raw || typeof raw !== 'object') return out;
  const seen = new Set();
  for (const x of Array.isArray(raw.list) ? raw.list.slice(0, IDEAS_MAX) : []) {
    if (!x || typeof x !== 'object') continue;
    const title = str(x.title, 200).trim();
    if (!title) continue;
    const id = okId(x.id) && !seen.has(x.id) ? x.id : uid();
    seen.add(id);
    const steps = [];
    for (const s of Array.isArray(x.steps) ? x.steps.slice(0, STEPS_MAX) : []) {
      const t = s && typeof s === 'object' ? str(s.t, 160).trim() : '';
      if (t) steps.push({ id: okId(s.id) ? s.id : uid(), t, doneAt: stamp(s.doneAt), at: stamp(s.at) || nowMs });
    }
    out.list.push({ id, title, kind: IDEA_KINDS[x.kind] ? x.kind : 'create', note: str(x.note, 2000), steps, createdAt: stamp(x.createdAt) || nowMs, doneAt: stamp(x.doneAt), parkedAt: stamp(x.parkedAt) });
  }
  out.focus = okId(raw.focus) && out.list.some((x) => x.id === raw.focus && isOpenIdea(x)) ? raw.focus : '';
  out.at = raw.at === '' ? '' : parseHM(raw.at) == null ? '20:00' : fmtHM(parseHM(raw.at));
  out.min = SLOT_MINS.includes(raw.min) ? raw.min : 25;
  if (raw.log && typeof raw.log === 'object') {
    for (const [k, v] of Object.entries(raw.log).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).slice(-LOG_MAX)) {
      if (isKey(k) && Number.isFinite(v) && v > 0) out.log[k] = Math.min(99, Math.round(v));
    }
  }
  const t = raw.timer;
  out.timer = t && typeof t === 'object' && okId(t.id) && stamp(t.start) && SLOT_MINS.concat([5]).includes(t.mins) ? { id: t.id, start: stamp(t.start), mins: t.mins } : null;
  return out;
}
