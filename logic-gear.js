// ОПОРА 365 — екіпірування: категорії, предмети, перевірки та їхня історія.
// Статус категорії рахується лише з фактичних перевірок — без «відсотків готовності».
import { todayKey, diffDays, isKey, uid, kyivParts, daysWord } from './time.js';

export const GEAR_CATS = [
  { id: 'issued', name: 'Підзвітне майно', short: 'Майно', icon: 'box' },
  { id: 'personal', name: 'Особисте спорядження', short: 'Особисте', icon: 'shirt' },
  { id: 'med', name: 'Медичний рюкзак', short: 'Медичний', icon: 'medkit' },
  { id: 'alarm', name: 'Тривожний рюкзак', short: 'Тривожний', icon: 'backpack' },
  { id: 'comms', name: 'Засоби звʼязку та живлення', short: 'Звʼязок', icon: 'radio' },
];
export const CAT = Object.fromEntries(GEAR_CATS.map((c) => [c.id, c]));

export const CHECK_TYPES = [
  { id: 'plan', name: 'Планова' },
  { id: 'before', name: 'Перед виїздом' },
  { id: 'after', name: 'Після використання' },
  { id: 'extra', name: 'Позапланова' },
];
export const CHECK_TYPE = Object.fromEntries(CHECK_TYPES.map((t) => [t.id, t]));
export const PERIODS = [1, 3, 7, 14, 30];
export const MARKS = [
  { id: 'ok', name: 'Є', long: 'Є, справне', icon: 'check' },
  { id: 'issue', name: 'Недолік', long: 'Є недолік', icon: 'alert' },
  { id: 'miss', name: 'Немає', long: 'Відсутнє', icon: 'x' },
];
export const STATUS = {
  ok: { name: 'Перевірено без недоліків', short: 'Без недоліків', icon: 'checkCircle' },
  issues: { name: 'Є недоліки', short: 'Недоліки', icon: 'alertCircle' },
  needs: { name: 'Потребує перевірки', short: 'Перевірити', icon: 'circleDash' },
  running: { name: 'Перевірка триває', short: 'Триває', icon: 'half' },
};
export const HISTORY_MAX = 200;
export const EXP_SOON = 14;

const item = (name, qty = 1, critical = false) => ({ id: uid(), name, qty, critical, exp: '', note: '', addedAt: 0 });

// Типові переліки — загальні назви без службових даних. Їх можна змінити або видалити.
export function defaultGear() {
  return {
    cats: {
      issued: { period: 7, items: [item('Службове посвідчення', 1, true), item('Жетон', 1, true), item('Спецзасоби', 1), item('Бронежилет', 1), item('Шолом', 1)] },
      personal: { period: 7, items: [item('Одяг за погодою'), item('Взуття'), item('Рукавички'), item('Головний убір'), item('Ліхтар'), item('Мультитул')] },
      med: { period: 7, items: [item('Турнікет', 2, true), item('Гемостатичний бинт', 1, true), item('Компресійний бинт', 2), item('Оклюзійна наліпка', 2), item('Назофарингеальний повітровід'), item('Ножиці'), item('Термоковдра'), item('Рукавички нітрилові', 2), item('Маркер')] },
      alarm: { period: 30, items: [item('Копії документів', 1, true), item('Вода', 2), item('Сухий пайок'), item('Павербанк'), item('Ліхтар і батарейки'), item('Змінний одяг'), item('Засоби гігієни'), item('Готівка')] },
      comms: { period: 3, items: [item('Телефон заряджений', 1, true), item('Павербанк заряджений', 1, true), item('Кабелі', 2), item('Рація заряджена'), item('Запасні батареї'), item('Навушники')] },
    },
    active: {},
    history: [],
  };
}

/* ---------- Статус категорії ---------- */

const fresh = (ms, today) => Math.max(0, diffDays(todayKey(ms), today));

export function lastCheck(gear, cat) {
  return gear.history.find((c) => c.cat === cat) || null;
}

export function catStatus(gear, cat, nowMs = Date.now()) {
  const c = gear.cats[cat];
  const items = c.items;
  const today = todayKey(nowMs);
  const expired = items.filter((i) => i.exp && i.exp < today);
  const soon = items.filter((i) => i.exp && i.exp >= today && diffDays(today, i.exp) <= EXP_SOON);
  const run = gear.active[cat];
  const last = lastCheck(gear, cat);
  const base = { cat, total: items.length, expired, soon, last, age: last ? fresh(last.finishedAt, today) : null, period: c.period };
  if (run) {
    const marked = items.filter((i) => run.marks[i.id]).length;
    return { ...base, s: 'running', marked, run };
  }
  if (!items.length) return { ...base, s: 'needs', reason: 'empty', text: 'Додайте предмети' };
  if (!last) return { ...base, s: 'needs', reason: 'never', text: 'Ще не перевірялось' };
  const problems = items.filter((i) => (last.marks[i.id] === 'issue' || last.marks[i.id] === 'miss') && !last.fixed[i.id]);
  if (problems.length || expired.length) {
    const miss = problems.filter((i) => last.marks[i.id] === 'miss').length;
    const parts = [];
    if (miss) parts.push(`відсутнє: ${miss}`);
    if (problems.length - miss) parts.push(`недоліки: ${problems.length - miss}`);
    if (expired.length) parts.push(`термін минув: ${expired.length}`);
    return { ...base, s: 'issues', problems, miss, text: parts.join(' · ').replace(/^./, (x) => x.toUpperCase()) };
  }
  const unverified = items.filter((i) => !last.marks[i.id]);
  if (unverified.length) return { ...base, s: 'needs', reason: 'new', unverified, text: `Не перевірено нових: ${unverified.length}` };
  if (base.age > c.period) return { ...base, s: 'needs', reason: 'stale', text: `Остання перевірка ${daysWord(base.age)} тому` };
  return { ...base, s: 'ok', text: base.age === 0 ? 'Перевірено сьогодні' : base.age === 1 ? 'Перевірено вчора' : `Перевірено ${daysWord(base.age)} тому` };
}

export function gearSummary(gear, nowMs = Date.now()) {
  const cats = GEAR_CATS.map((c) => ({ ...c, st: catStatus(gear, c.id, nowMs) }));
  const by = (s) => cats.filter((c) => c.st.s === s);
  return { cats, ok: by('ok').length, issues: by('issues').length, needs: by('needs').length, running: by('running').length, total: cats.length };
}

/* ---------- Перевірка ---------- */

export function startCheck(gear, cat, type = 'plan', nowMs = Date.now()) {
  if (gear.active[cat]) return gear.active[cat];
  const run = { id: uid(), cat, type: CHECK_TYPE[type] ? type : 'plan', startedAt: nowMs, finishedAt: 0, marks: {}, notes: {}, names: {}, fixed: {} };
  gear.active[cat] = run;
  return run;
}

export function markItem(gear, cat, itemId, mark, note) {
  const run = gear.active[cat];
  if (!run) return;
  if (mark === null) { delete run.marks[itemId]; delete run.notes[itemId]; return; }
  if (!MARKS.some((m) => m.id === mark)) return;
  run.marks[itemId] = mark;
  if (mark === 'ok') delete run.notes[itemId];
  if (typeof note === 'string') {
    const n = note.trim().slice(0, 300);
    if (n && mark !== 'ok') run.notes[itemId] = n; else delete run.notes[itemId];
  }
}

export function checkProgress(gear, cat) {
  const run = gear.active[cat];
  const items = gear.cats[cat].items;
  const marked = run ? items.filter((i) => run.marks[i.id]).length : 0;
  return { marked, total: items.length, left: items.length - marked, can: !!run && items.length > 0 && marked === items.length };
}

export function summaryOf(check) {
  const v = Object.values(check.marks);
  const ok = v.filter((m) => m === 'ok').length;
  const issue = v.filter((m) => m === 'issue').length;
  const miss = v.filter((m) => m === 'miss').length;
  return { ok, issue, miss, total: v.length, clean: issue + miss === 0 };
}

// Завершити можна лише тоді, коли кожен предмет позначено.
export function finishCheck(gear, cat, nowMs = Date.now()) {
  const run = gear.active[cat];
  if (!run) return { ok: false, error: 'Перевірку не розпочато.' };
  const pr = checkProgress(gear, cat);
  if (!pr.can) return { ok: false, error: `Не позначено предметів: ${pr.left}.` };
  const items = gear.cats[cat].items;
  const marks = {}, notes = {}, names = {};
  for (const i of items) {
    marks[i.id] = run.marks[i.id];
    names[i.id] = i.name;
    if (run.notes[i.id]) notes[i.id] = run.notes[i.id];
  }
  const done = { ...run, marks, notes, names, fixed: {}, finishedAt: nowMs };
  delete gear.active[cat];
  gear.history.unshift(done);
  if (gear.history.length > HISTORY_MAX) gear.history.length = HISTORY_MAX;
  return { ok: true, check: done, sum: summaryOf(done) };
}

export function cancelCheck(gear, cat) {
  delete gear.active[cat];
}

// Недолік усунуто — підтвердження саме цього предмета, без нової повної перевірки.
export function fixIssue(gear, cat, itemId, nowMs = Date.now()) {
  const last = lastCheck(gear, cat);
  if (!last || !(last.marks[itemId] === 'issue' || last.marks[itemId] === 'miss')) return false;
  last.fixed[itemId] = nowMs;
  return true;
}

export function checkIssues(check) {
  return Object.entries(check.marks)
    .filter(([, m]) => m === 'issue' || m === 'miss')
    .map(([id, m]) => ({ id, mark: m, name: check.names[id] || 'Предмет', note: check.notes[id] || '', fixed: check.fixed?.[id] || 0 }));
}

// Останні N перевірок категорії для мініісторії: ok | issues.
export function catTrail(gear, cat, n = 8) {
  return gear.history.filter((c) => c.cat === cat).slice(0, n).map((c) => (summaryOf(c).clean ? 'ok' : 'issues')).reverse();
}

export function checkTime(check) {
  const p = kyivParts(check.finishedAt || check.startedAt);
  return { date: p.date, min: p.min };
}

/* ---------- Предмети ---------- */

export function cleanItem(raw, nowMs = Date.now()) {
  const name = typeof raw?.name === 'string' ? raw.name.trim().slice(0, 80) : '';
  if (!name) return null;
  const qty = Math.round(Number(raw.qty));
  return {
    id: typeof raw.id === 'string' && /^[\w-]{1,64}$/.test(raw.id) ? raw.id : uid(),
    name,
    qty: Number.isFinite(qty) ? Math.min(999, Math.max(1, qty)) : 1,
    critical: raw.critical === true,
    exp: isKey(raw.exp) ? raw.exp : '',
    note: typeof raw.note === 'string' ? raw.note.slice(0, 300) : '',
    addedAt: Number.isFinite(+raw.addedAt) && +raw.addedAt > 0 ? +raw.addedAt : nowMs,
  };
}

/* ---------- Перевірка збережених даних ---------- */

const plain = (o) => o && typeof o === 'object' && !Array.isArray(o);
const stamp = (v) => (Number.isFinite(+v) && +v > 0 ? +v : 0);
const strMap = (o, max) => {
  const out = {};
  if (plain(o)) for (const [k, v] of Object.entries(o)) if (typeof v === 'string' && v.trim()) out[k] = v.slice(0, max);
  return out;
};

function cleanCheck(raw, cat) {
  if (!plain(raw) || !stamp(raw.startedAt)) return null;
  const marks = {};
  if (plain(raw.marks)) for (const [k, v] of Object.entries(raw.marks)) if (MARKS.some((m) => m.id === v)) marks[k] = v;
  const fixed = {};
  if (plain(raw.fixed)) for (const [k, v] of Object.entries(raw.fixed)) if (stamp(v)) fixed[k] = stamp(v);
  return {
    id: typeof raw.id === 'string' && /^[\w-]{1,64}$/.test(raw.id) ? raw.id : uid(),
    cat,
    type: CHECK_TYPE[raw.type] ? raw.type : 'plan',
    startedAt: stamp(raw.startedAt),
    finishedAt: stamp(raw.finishedAt),
    marks,
    notes: strMap(raw.notes, 300),
    names: strMap(raw.names, 80),
    fixed,
  };
}

export function cleanGear(raw, nowMs = Date.now()) {
  const d = defaultGear();
  if (!plain(raw)) return d;
  const cats = {};
  for (const c of GEAR_CATS) {
    const rc = plain(raw.cats) && plain(raw.cats[c.id]) ? raw.cats[c.id] : null;
    if (!rc) { cats[c.id] = d.cats[c.id]; continue; }
    const seen = new Set();
    const items = [];
    for (const x of Array.isArray(rc.items) ? rc.items.slice(0, 200) : []) {
      const it = cleanItem(x, nowMs);
      if (!it) continue;
      if (seen.has(it.id)) it.id = uid();
      seen.add(it.id);
      items.push(it);
    }
    cats[c.id] = { period: PERIODS.includes(+rc.period) ? +rc.period : d.cats[c.id].period, items };
  }
  const active = {};
  if (plain(raw.active)) {
    for (const c of GEAR_CATS) {
      const ch = cleanCheck(raw.active[c.id], c.id);
      if (ch) { ch.finishedAt = 0; active[c.id] = ch; }
    }
  }
  const history = [];
  for (const x of Array.isArray(raw.history) ? raw.history.slice(0, HISTORY_MAX) : []) {
    if (!plain(x) || !CAT[x.cat]) continue;
    const ch = cleanCheck(x, x.cat);
    if (ch && ch.finishedAt) history.push(ch);
  }
  history.sort((a, b) => b.finishedAt - a.finishedAt);
  return { cats, active, history };
}
