// ОПОРА 365 — Центр готовності: категорії, предмети, перевірки та їхня історія.
// Стан предмета й категорії рахується лише з фактичних перевірок — без «відсотків готовності».
// Це особистий допоміжний облік, а не заміна службової документації.
import { todayKey, diffDays, isKey, uid, kyivParts, daysWord } from './time.js';

export const GEAR_CATS = [
  { id: 'issued', name: 'Службове підзвітне майно', short: 'Майно', icon: 'box', owner: 'issued', duty: true, period: 1 },
  { id: 'personal', name: 'Особисте спорядження', short: 'Особисте', icon: 'shirt', owner: 'personal', duty: true, period: 7 },
  { id: 'med', name: 'Медичний рюкзак', short: 'Медичний', icon: 'medkit', owner: 'personal', duty: true, period: 7 },
  { id: 'alarm', name: 'Тривожний рюкзак', short: 'Тривожний', icon: 'backpack', owner: 'personal', duty: false, period: 30 },
  { id: 'comms', name: 'Звʼязок і живлення', short: 'Звʼязок', icon: 'radio', owner: 'personal', duty: true, period: 1 },
];
export const CAT = Object.fromEntries(GEAR_CATS.map((c) => [c.id, c]));
export const CUSTOM_ICONS = ['box', 'backpack', 'medkit', 'shirt', 'radio', 'car', 'tool', 'bag', 'home', 'file'];
export const CUSTOM_MAX = 8;
export const OWNERS = [
  { id: 'issued', name: 'Підзвітне' },
  { id: 'personal', name: 'Особисте' },
];

export const CHECK_TYPES = [
  { id: 'daily', name: 'Щоденна', hint: 'Категорії, які перевіряєте щодня' },
  { id: 'duty', name: 'Перед чергуванням', hint: 'Набір категорій для виходу на чергування' },
  { id: 'weekly', name: 'Щотижнева', hint: 'Усі категорії з предметами' },
  { id: 'demand', name: 'На вимогу', hint: 'Одна категорія — коли потрібно' },
];
export const CHECK_TYPE = Object.fromEntries(CHECK_TYPES.map((t) => [t.id, t]));
// Типи перевірок попередньої версії лишаються в історії під своїми назвами.
const LEGACY_TYPES = { plan: 'Планова', before: 'Перед виїздом', after: 'Після використання', extra: 'Позапланова' };
export const checkTypeName = (id) => CHECK_TYPE[id]?.name || LEGACY_TYPES[id] || 'Перевірка';

export const PERIODS = [1, 3, 7, 14, 30];
export const MARKS = [
  { id: 'ok', name: 'Справне', long: 'Є, справне', icon: 'check' },
  { id: 'missing', name: 'Відсутнє', long: 'Відсутнє', icon: 'x' },
  { id: 'broken', name: 'Несправне', long: 'Несправне', icon: 'alert' },
  { id: 'refill', name: 'Поповнити', long: 'Потрібне поповнення', icon: 'refill' },
];
export const MARK = Object.fromEntries(MARKS.map((m) => [m.id, m]));
const LEGACY_MARK = { issue: 'broken', miss: 'missing' };
const PROBLEM = new Set(['missing', 'broken', 'refill']);
export const isProblem = (m) => PROBLEM.has(m);

// Стан окремого предмета.
export const ITEM_ST = {
  ok: { name: 'Перевірено', icon: 'checkCircle', tone: 'teal' },
  unchecked: { name: 'Не перевірено', icon: 'circleDash', tone: 'slate' },
  missing: { name: 'Відсутнє', icon: 'xCircle', tone: 'coral' },
  broken: { name: 'Несправне', icon: 'alertCircle', tone: 'coral' },
  refill: { name: 'Потрібне поповнення', icon: 'refill', tone: 'amber' },
};
// Стан категорії.
export const STATUS = {
  ok: { name: 'Перевірено без зауважень', short: 'Без зауважень', icon: 'checkCircle', tone: 'teal' },
  issues: { name: 'Потребує уваги', short: 'Є проблеми', icon: 'alertCircle', tone: 'amber' },
  needs: { name: 'Потрібна перевірка', short: 'Перевірити', icon: 'circleDash', tone: 'slate' },
  running: { name: 'Перевірка триває', short: 'Триває', icon: 'half', tone: 'blue' },
  empty: { name: 'Немає предметів', short: 'Порожньо', icon: 'plus', tone: 'slate' },
};
export const HISTORY_MAX = 300;
export const EXP_SOON = 14;

const item = (name, qty = 1, critical = false, owner = 'personal') => ({ id: uid(), name, qty, critical, exp: '', note: '', addedAt: 0, owner });

// Типові переліки — загальні назви без службових даних. Їх можна змінити або видалити.
export function defaultGear() {
  return {
    cats: {
      issued: { period: 1, duty: true, items: [item('Службове посвідчення', 1, true, 'issued'), item('Жетон', 1, true, 'issued'), item('Спецзасоби', 1, false, 'issued'), item('Бронежилет', 1, false, 'issued'), item('Шолом', 1, false, 'issued')] },
      personal: { period: 7, duty: true, items: [item('Одяг за погодою'), item('Взуття'), item('Рукавички'), item('Головний убір'), item('Ліхтар'), item('Мультитул')] },
      med: { period: 7, duty: true, items: [item('Турнікет', 2, true), item('Гемостатичний бинт', 1, true), item('Компресійний бинт', 2), item('Оклюзійна наліпка', 2), item('Назофарингеальний повітровід'), item('Ножиці'), item('Термоковдра'), item('Рукавички нітрилові', 2), item('Маркер')] },
      alarm: { period: 30, duty: false, items: [item('Копії документів', 1, true), item('Вода', 2), item('Сухий пайок'), item('Павербанк'), item('Ліхтар і батарейки'), item('Змінний одяг'), item('Засоби гігієни'), item('Готівка')] },
      comms: { period: 1, duty: true, items: [item('Телефон заряджений', 1, true), item('Павербанк заряджений', 1, true), item('Кабелі', 2), item('Рація заряджена'), item('Запасні батареї'), item('Навушники')] },
    },
    custom: [],
    active: {},
    history: [],
  };
}

/* ---------- Категорії: вбудовані й власні ---------- */

export function catList(gear) {
  const custom = (gear.custom || []).map((c) => ({ id: c.id, name: c.name, short: c.name, icon: c.icon, owner: 'personal', builtIn: false }));
  return [...GEAR_CATS.map((c) => ({ ...c, builtIn: true })), ...custom];
}
export function catMeta(gear, id) {
  return catList(gear).find((c) => c.id === id) || { id, name: 'Категорія', short: 'Категорія', icon: 'box', owner: 'personal', builtIn: false };
}

export function addCategory(gear, name, icon = 'box') {
  const title = String(name || '').trim().slice(0, 40);
  if (!title || (gear.custom || []).length >= CUSTOM_MAX) return null;
  const id = `c-${uid().slice(0, 12).replace(/[^\w-]/g, '')}`;
  gear.custom.push({ id, name: title, icon: CUSTOM_ICONS.includes(icon) ? icon : 'box' });
  gear.cats[id] = { period: 7, duty: false, items: [] };
  return id;
}

export function removeCategory(gear, id) {
  if (CAT[id]) return false;
  gear.custom = gear.custom.filter((c) => c.id !== id);
  delete gear.cats[id];
  delete gear.active[id];
  return true;
}

/* ---------- Стан предмета й категорії ---------- */

export function lastCheck(gear, cat) {
  return gear.history.find((c) => c.cat === cat) || null;
}

function lastMarkOf(gear, cat, itemId) {
  for (const c of gear.history) if (c.cat === cat && c.marks[itemId]) return { mark: c.marks[itemId], check: c };
  return null;
}

export function itemStatus(gear, cat, it, nowMs = Date.now()) {
  const today = todayKey(nowMs);
  const period = gear.cats[cat]?.period ?? 7;
  const found = lastMarkOf(gear, cat, it.id);
  const expired = !!it.exp && it.exp < today;
  const soon = !!it.exp && !expired && diffDays(today, it.exp) <= EXP_SOON;
  let s = 'unchecked', reason = 'never', at = 0, age = null, note = '', fixedAt = 0;
  if (found) {
    at = found.check.finishedAt;
    age = Math.max(0, diffDays(todayKey(at), today));
    note = found.check.notes[it.id] || '';
    fixedAt = found.check.fixed?.[it.id] || 0;
    if (found.mark === 'ok' || fixedAt) {
      const stale = age > period;
      s = stale ? 'unchecked' : 'ok';
      reason = stale ? 'stale' : fixedAt ? 'fixed' : 'checked';
    } else {
      s = found.mark;
      reason = 'marked';
    }
  }
  if (expired) { s = 'refill'; reason = 'expired'; }
  return { s, reason, at, age, note, fixedAt, expired, soon, mark: found ? found.mark : '' };
}

const capital = (t) => t.replace(/^./, (x) => x.toUpperCase());

export function catStatus(gear, cat, nowMs = Date.now()) {
  const data = gear.cats[cat] || { period: 7, items: [] };
  const items = data.items;
  const sts = items.map((i) => ({ item: i, st: itemStatus(gear, cat, i, nowMs) }));
  const count = { ok: 0, unchecked: 0, missing: 0, broken: 0, refill: 0 };
  for (const x of sts) count[x.st.s]++;
  const today = todayKey(nowMs);
  const last = lastCheck(gear, cat);
  const run = gear.active[cat];
  const base = {
    cat, total: items.length, items: sts, count, last, period: data.period,
    age: last ? Math.max(0, diffDays(todayKey(last.finishedAt), today)) : null,
    expired: sts.filter((x) => x.st.expired).map((x) => x.item),
    soon: sts.filter((x) => x.st.soon).map((x) => x.item),
  };
  if (run) {
    const marked = items.filter((i) => run.marks[i.id]).length;
    return { ...base, s: 'running', marked, run, text: `Позначено ${marked} з ${items.length}` };
  }
  if (!items.length) return { ...base, s: 'empty', text: 'Додайте перший предмет' };
  const problems = sts.filter((x) => isProblem(x.st.s));
  if (problems.length) {
    const parts = [];
    if (count.missing) parts.push(`відсутнє: ${count.missing}`);
    if (count.broken) parts.push(`несправне: ${count.broken}`);
    if (count.refill) parts.push(`поповнити: ${count.refill}`);
    return { ...base, s: 'issues', problems, text: capital(parts.join(', ')) };
  }
  const unchecked = sts.filter((x) => x.st.s === 'unchecked');
  if (unchecked.length) {
    let reason = 'stale', text = `Остання перевірка ${daysWord(base.age ?? 0)} тому`;
    if (!last) { reason = 'never'; text = 'Ще не перевірялось'; }
    else if (unchecked.some((x) => x.st.reason === 'never')) { reason = 'new'; text = `Не перевірено предметів: ${unchecked.length}`; }
    return { ...base, s: 'needs', reason, unchecked, text };
  }
  const text = base.age === 0 ? 'Перевірено сьогодні' : base.age === 1 ? 'Перевірено вчора' : `Перевірено ${daysWord(base.age)} тому`;
  return { ...base, s: 'ok', text };
}

export function gearSummary(gear, nowMs = Date.now()) {
  const cats = catList(gear).map((c) => ({ ...c, st: catStatus(gear, c.id, nowMs) }));
  const by = (s) => cats.filter((c) => c.st.s === s).length;
  const used = cats.filter((c) => c.st.s !== 'empty');
  return { cats, ok: by('ok'), issues: by('issues'), needs: by('needs'), running: by('running'), empty: by('empty'), total: used.length, all: cats.length };
}

// Проблемні предмети в усіх категоріях: відсутнє, несправне, поповнити, термін придатності.
export function problemList(gear, nowMs = Date.now()) {
  const out = [];
  for (const c of catList(gear)) {
    const data = gear.cats[c.id];
    if (!data) continue;
    for (const it of data.items) {
      const st = itemStatus(gear, c.id, it, nowMs);
      if (isProblem(st.s) || st.soon) out.push({ cat: c.id, catName: c.short, item: it, st, soonOnly: !isProblem(st.s) });
    }
  }
  const w = (x) => (x.soonOnly ? 2 : x.st.s === 'refill' ? 1 : 0);
  return out.sort((a, b) => w(a) - w(b));
}

/* ---------- Перевірка ---------- */

export function startCheck(gear, cat, type = 'demand', nowMs = Date.now()) {
  if (gear.active[cat]) return gear.active[cat];
  const t = CHECK_TYPE[type] ? type : 'demand';
  const run = { id: uid(), cat, type: t, startedAt: nowMs, finishedAt: 0, marks: {}, notes: {}, names: {}, fixed: {} };
  gear.active[cat] = run;
  return run;
}

export function markItem(gear, cat, itemId, mark, note) {
  const run = gear.active[cat];
  if (!run) return;
  if (mark === null) { delete run.marks[itemId]; delete run.notes[itemId]; return; }
  const m = LEGACY_MARK[mark] || mark;
  if (!MARK[m]) return;
  run.marks[itemId] = m;
  if (m === 'ok') delete run.notes[itemId];
  if (typeof note === 'string') {
    const n = note.trim().slice(0, 300);
    if (n && m !== 'ok') run.notes[itemId] = n; else delete run.notes[itemId];
  }
}

export function checkProgress(gear, cat) {
  const run = gear.active[cat];
  const items = gear.cats[cat]?.items || [];
  const marked = run ? items.filter((i) => run.marks[i.id]).length : 0;
  return { marked, total: items.length, left: items.length - marked, can: !!run && items.length > 0 && marked === items.length };
}

export function summaryOf(check) {
  const v = Object.values(check.marks);
  const n = (id) => v.filter((m) => m === id).length;
  const missing = n('missing'), broken = n('broken'), refill = n('refill');
  return { ok: n('ok'), missing, broken, refill, total: v.length, clean: missing + broken + refill === 0 };
}

// Завершити можна лише тоді, коли кожен предмет позначено. Кожна перевірка — окремий запис історії.
export function finishCheck(gear, cat, nowMs = Date.now()) {
  const run = gear.active[cat];
  if (!run) return { ok: false, error: 'Перевірку не розпочато.' };
  const pr = checkProgress(gear, cat);
  if (!pr.can) return { ok: false, error: `Не позначено предметів: ${pr.left}.` };
  const marks = {}, notes = {}, names = {};
  for (const i of gear.cats[cat].items) {
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

// Проблему усунуто: позначка в записі перевірки, де її виявлено. Сам результат перевірки не змінюється.
export function fixIssue(gear, cat, itemId, nowMs = Date.now()) {
  const found = lastMarkOf(gear, cat, itemId);
  if (!found || !isProblem(found.mark)) return false;
  found.check.fixed[itemId] = nowMs;
  return true;
}
export function unfixIssue(gear, cat, itemId) {
  const found = lastMarkOf(gear, cat, itemId);
  if (found) delete found.check.fixed[itemId];
}

export function checkIssues(check) {
  return Object.entries(check.marks)
    .filter(([, m]) => isProblem(m))
    .map(([id, m]) => ({ id, mark: m, name: check.names[id] || 'Предмет', note: check.notes[id] || '', fixed: check.fixed?.[id] || 0 }));
}

export function catTrail(gear, cat, n = 8) {
  return gear.history.filter((c) => c.cat === cat).slice(0, n).map((c) => (summaryOf(c).clean ? 'ok' : 'issues')).reverse();
}

export function checkTime(check) {
  const p = kyivParts(check.finishedAt || check.startedAt);
  return { date: p.date, min: p.min };
}

// Набір категорій для комплексної перевірки.
export function queueFor(gear, type) {
  const cats = catList(gear).filter((c) => gear.cats[c.id]?.items.length);
  let pick = [];
  if (type === 'duty') pick = cats.filter((c) => gear.cats[c.id].duty);
  else if (type === 'daily') pick = cats.filter((c) => gear.cats[c.id].period <= 1);
  else if (type === 'weekly') pick = cats;
  return (pick.length || type === 'demand' ? pick : cats).map((c) => c.id);
}

/* ---------- Предмети ---------- */

export function cleanItem(raw, nowMs = Date.now(), cat = '') {
  const name = typeof raw?.name === 'string' ? raw.name.trim().slice(0, 80) : '';
  if (!name) return null;
  const qty = Math.round(Number(raw.qty));
  const owner = raw.owner === 'issued' || raw.owner === 'personal' ? raw.owner : cat === 'issued' ? 'issued' : 'personal';
  return {
    id: typeof raw.id === 'string' && /^[\w-]{1,64}$/.test(raw.id) ? raw.id : uid(),
    name,
    qty: Number.isFinite(qty) ? Math.min(999, Math.max(1, qty)) : 1,
    critical: raw.critical === true,
    exp: isKey(raw.exp) ? raw.exp : '',
    note: typeof raw.note === 'string' ? raw.note.slice(0, 300) : '',
    addedAt: Number.isFinite(+raw.addedAt) && +raw.addedAt > 0 ? +raw.addedAt : nowMs,
    owner,
  };
}

/* ---------- Перевірка збережених даних ---------- */

const plain = (o) => o && typeof o === 'object' && !Array.isArray(o);
const stamp = (v) => (Number.isFinite(+v) && +v > 0 ? +v : 0);
const okId = (v) => typeof v === 'string' && /^[\w-]{1,64}$/.test(v);
const strMap = (o, max) => {
  const out = {};
  if (plain(o)) for (const [k, v] of Object.entries(o)) if (typeof v === 'string' && v.trim()) out[k] = v.slice(0, max);
  return out;
};

function cleanCheck(raw, cat) {
  if (!plain(raw) || !stamp(raw.startedAt)) return null;
  const marks = {};
  if (plain(raw.marks)) {
    for (const [k, v] of Object.entries(raw.marks)) {
      const m = LEGACY_MARK[v] || v;
      if (MARK[m]) marks[k] = m;
    }
  }
  const fixed = {};
  if (plain(raw.fixed)) for (const [k, v] of Object.entries(raw.fixed)) if (stamp(v)) fixed[k] = stamp(v);
  return {
    id: okId(raw.id) ? raw.id : uid(),
    cat,
    type: CHECK_TYPE[raw.type] || LEGACY_TYPES[raw.type] ? raw.type : 'demand',
    startedAt: stamp(raw.startedAt),
    finishedAt: stamp(raw.finishedAt),
    marks,
    notes: strMap(raw.notes, 300),
    names: strMap(raw.names, 80),
    fixed,
  };
}

function cleanItems(list, nowMs, cat) {
  const seen = new Set();
  const items = [];
  for (const x of Array.isArray(list) ? list.slice(0, 200) : []) {
    const it = cleanItem(x, nowMs, cat);
    if (!it) continue;
    if (seen.has(it.id)) it.id = uid();
    seen.add(it.id);
    items.push(it);
  }
  return items;
}

export function cleanGear(raw, nowMs = Date.now()) {
  const d = defaultGear();
  if (!plain(raw)) return d;
  const cats = {};
  for (const c of GEAR_CATS) {
    const rc = plain(raw.cats) && plain(raw.cats[c.id]) ? raw.cats[c.id] : null;
    if (!rc) { cats[c.id] = d.cats[c.id]; continue; }
    cats[c.id] = {
      period: PERIODS.includes(+rc.period) ? +rc.period : d.cats[c.id].period,
      duty: typeof rc.duty === 'boolean' ? rc.duty : c.duty,
      items: cleanItems(rc.items, nowMs, c.id),
    };
  }
  const custom = [];
  for (const x of Array.isArray(raw.custom) ? raw.custom.slice(0, CUSTOM_MAX) : []) {
    if (!plain(x) || !okId(x.id) || CAT[x.id] || custom.some((c) => c.id === x.id)) continue;
    const name = typeof x.name === 'string' ? x.name.trim().slice(0, 40) : '';
    if (!name) continue;
    custom.push({ id: x.id, name, icon: CUSTOM_ICONS.includes(x.icon) ? x.icon : 'box' });
    const rc = plain(raw.cats) && plain(raw.cats[x.id]) ? raw.cats[x.id] : {};
    cats[x.id] = { period: PERIODS.includes(+rc.period) ? +rc.period : 7, duty: rc.duty === true, items: cleanItems(rc.items, nowMs, x.id) };
  }
  const known = (id) => !!cats[id];
  const active = {};
  if (plain(raw.active)) {
    for (const id of Object.keys(cats)) {
      const ch = cleanCheck(raw.active[id], id);
      if (ch) { ch.finishedAt = 0; active[id] = ch; }
    }
  }
  const history = [];
  for (const x of Array.isArray(raw.history) ? raw.history.slice(0, HISTORY_MAX) : []) {
    if (!plain(x) || !known(x.cat)) continue;
    const ch = cleanCheck(x, x.cat);
    if (ch && ch.finishedAt) history.push(ch);
  }
  history.sort((a, b) => b.finishedAt - a.finishedAt);
  return { cats, custom, active, history };
}
