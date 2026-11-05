// ОПОРА 365 — швидкі сценарії (організаційні чеклісти занять і зборів), доручення та каталог інструментів.
// Тут немає бойових алгоритмів, схем позицій чи тактичних рекомендацій — лише особиста організація.
// Сценарії не збирають оперативних відомостей.
import { uid, isKey, parseHM, fmtHM } from './time.js';

export const KINDS = [
  { id: 'med', name: 'Домедична підготовка', desc: 'Організувати заняття: план, манекени, турнікети', icon: 'medkit', tone: 'teal' },
  { id: 'tac', name: 'Тактична підготовка', desc: 'Організувати заняття й інструктаж із безпеки', icon: 'compass', tone: 'blue' },
  { id: 'fire', name: 'Вогнева підготовка', desc: 'Допуски, засоби захисту, журнали', icon: 'target', tone: 'amber' },
  { id: 'go', name: 'Терміновий виїзд', desc: 'Зібратися швидко й нічого не забути', icon: 'exit', tone: 'coral' },
  { id: 'task', name: 'Несподіване доручення', desc: 'Записати за хвилину й одразу додати в справи', icon: 'clipboard', tone: 'moon' },
  { id: 'custom', name: 'Власний сценарій', desc: 'Ваш чекліст на будь-який випадок', icon: 'layers', tone: 'slate' },
];
export const KIND = Object.fromEntries(KINDS.map((k) => [k.id, k]));
export const RUNS_MAX = 80;
export const CUSTOM_MAX = 12;
export const FAVS_MAX = 8;

const st = (t, req = false) => ({ id: uid(), t, req });
const build = ([items, req]) => items.map((t, i) => st(t, req.includes(i)));

const TEMPLATES = {
  med: [['План заняття', 'Матеріали', 'Манекени', 'Тренувальні турнікети', 'Перевʼязувальні засоби', 'Навчальна документація', 'Перевірка приміщення'], [0, 2, 3, 6]],
  tac: [['План', 'Документація', 'Дозволений навчальний інвентар', 'Підготовка місця', 'Інструктаж із безпеки'], [0, 3, 4]],
  fire: [['План', 'Документація', 'Допуски', 'Засоби захисту', 'Організаційна перевірка безпеки', 'Необхідні журнали'], [0, 2, 3, 4, 5]],
  go: [['Документи', 'Звʼязок', 'Живлення', 'Особисті речі', 'Екіпірування', 'Медичні засоби'], [0, 1, 2]],
};

// Типові шаблони попередньої версії: якщо користувач їх не змінював — замінюємо новими.
const V2_TEXTS = {
  med: ['Уточнити час, місце і кількість слухачів', 'План-конспект і тема заняття', 'Манекени й тренажери', 'Навчальні турнікети', 'Навчальний перевʼязувальний матеріал', 'Рукавички для слухачів', 'Журнал обліку занять', 'Проєктор або планшет заряджені'],
  tac: ['Уточнити тему, час і місце', 'План-конспект', 'Погодити заняття з керівником', 'Навчальне спорядження', 'Засоби звʼязку для заняття', 'Інструктаж з безпеки', 'Журнал обліку занять'],
  fire: ['Уточнити час, тир і кількість учасників', 'Погодження і відомість', 'Інструктаж з техніки безпеки', 'Засоби захисту слуху й зору', 'Аптечка на місці заняття', 'Мішені й матеріали', 'Журнал обліку'],
  go: ['Документи', 'Телефон і павербанк', 'Тривожний рюкзак', 'Медичний рюкзак', 'Засоби звʼязку заряджені', 'Вода', 'Ключі й гаманець', 'Повідомити рідних або керівника', 'Вимкнути прилади вдома'],
};
const V2_NAMES = { med: 'Домедична допомога' };

export function templateSteps(kind) {
  return TEMPLATES[kind] ? build(TEMPLATES[kind]) : [];
}

export function defaultScenarios() {
  return ['med', 'tac', 'fire', 'go', 'task'].map((k) => ({ id: `sc-${k}`, kind: k, title: KIND[k].name, steps: templateSteps(k) }));
}

export function defaultDeck() {
  return { scenarios: defaultScenarios(), active: null, runs: [], favs: [] };
}

/* ---------- Запуск сценарію ---------- */

export function startRun(deck, sc, nowMs = Date.now()) {
  deck.active = { id: uid(), sid: sc.id, title: sc.title, kind: sc.kind, startedAt: nowMs, finishedAt: 0, checked: {}, note: '', result: '' };
  return deck.active;
}

export function runProgress(run, sc) {
  const steps = sc ? sc.steps : [];
  const done = steps.filter((s) => run.checked[s.id]).length;
  const req = steps.filter((s) => s.req);
  const reqDone = req.filter((s) => run.checked[s.id]).length;
  return { done, total: steps.length, reqDone, reqTotal: req.length, missing: req.filter((s) => !run.checked[s.id]), complete: reqDone === req.length && steps.length > 0 };
}

// «Готово» — лише коли підтверджено всі обовʼязкові кроки. Інакше — «частково».
export function finishRun(deck, sc, nowMs = Date.now()) {
  const run = deck.active;
  if (!run) return null;
  const pr = runProgress(run, sc);
  const done = {
    ...run,
    finishedAt: nowMs,
    result: pr.complete ? 'done' : 'partial',
    total: pr.total,
    doneCount: pr.done,
    reqTotal: pr.reqTotal,
    reqDone: pr.reqDone,
    missing: pr.missing.map((s) => s.t),
  };
  deck.active = null;
  logRun(deck, done);
  return done;
}

function logRun(deck, r) {
  deck.runs.unshift(r);
  if (deck.runs.length > RUNS_MAX) deck.runs.length = RUNS_MAX;
}

/* ---------- Памʼять дій: останні й обрані ---------- */

export function toggleFav(deck, sid) {
  const has = deck.favs.includes(sid);
  if (has) deck.favs = deck.favs.filter((x) => x !== sid);
  else if (deck.favs.length < FAVS_MAX) deck.favs = [...deck.favs, sid];
  return !has;
}

// Останні використані сценарії — без повторів, найсвіжіші першими.
export function recentScenarios(deck, n = 4) {
  const out = [];
  const seen = new Set();
  for (const r of deck.runs) {
    if (!r.sid || seen.has(r.sid)) continue;
    const sc = deck.scenarios.find((s) => s.id === r.sid);
    if (!sc) continue;
    seen.add(r.sid);
    out.push({ sc, run: r });
    if (out.length >= n) break;
  }
  return out;
}

/* ---------- Несподіване доручення: швидка форма → справа ---------- */

export function assignmentTask({ what = '', date = '', time = '', pr = 1, needs = '' } = {}, today) {
  const title = String(what).trim().slice(0, 300);
  const due = isKey(date) ? date : today;
  const tm = parseHM(time);
  const sub = String(needs).split('\n').map((x) => x.trim().slice(0, 120)).filter(Boolean).slice(0, 30).map((t) => ({ id: uid(), t, d: 0 }));
  return {
    title,
    pr: [1, 2, 3].includes(+pr) ? +pr : 1,
    due,
    time: tm == null ? '' : fmtHM(tm),
    deadline: due,
    cat: 'work',
    note: '',
    sub,
  };
}

// Запис у памʼять дій: доручення теж зʼявляється серед останніх.
export function logAssignment(deck, title, nowMs = Date.now()) {
  logRun(deck, {
    id: uid(), sid: 'sc-task', title: `Доручення: ${String(title).slice(0, 48)}`, kind: 'task', startedAt: nowMs, finishedAt: nowMs,
    checked: {}, note: '', result: 'done', total: 0, doneCount: 0, reqTotal: 0, reqDone: 0, missing: [],
  });
}

/* ---------- Інструменти ---------- */

export const TOOL_CATS = [
  { id: 'work', name: 'Робота' },
  { id: 'apps', name: 'Мої застосунки' },
  { id: 'svc', name: 'Сервіси' },
  { id: 'info', name: 'Інформація' },
  { id: 'other', name: 'Інше' },
];
export const TOOL_TONES = ['blue', 'teal', 'amber', 'coral', 'moon', 'slate'];
// Загальні піктограми (не логотипи сервісів). Порожнє значення — літери з назви.
export const TOOL_ICONS = ['', 'calendar', 'mail', 'folder', 'file', 'code', 'globe', 'chat', 'map', 'alert', 'phone', 'book', 'briefcase', 'heart', 'radio', 'shield'];

const tool = (title, url, cat, tone, ic, fav = false) => ({ id: uid(), title, url, cat, tone, fav, glyph: '', icon: ic, createdAt: 0, usedAt: 0 });

export function defaultTools() {
  return [
    tool('Карта тривог', 'https://alerts.in.ua/', 'info', 'coral', 'alert', true),
    tool('Дія', 'https://diia.gov.ua/', 'svc', 'slate', 'file', true),
    tool('Календар', 'https://calendar.google.com/', 'work', 'blue', 'calendar', true),
    tool('Пошта', 'https://mail.google.com/', 'work', 'amber', 'mail'),
    tool('Диск', 'https://drive.google.com/', 'work', 'teal', 'folder'),
    tool('GitHub', 'https://github.com/', 'apps', 'moon', 'code'),
  ];
}

const BAD_PROTOCOLS = /^(javascript|data|vbscript|file|blob|about):/i;

// Перевіряє посилання. Дозволено https, http, mailto, tel, sms.
export function checkUrl(input) {
  let s = String(input ?? '').trim();
  if (!s) return { ok: false, error: 'Вкажіть посилання.' };
  if (s.length > 2000) return { ok: false, error: 'Посилання задовге.' };
  if (/\s/.test(s)) return { ok: false, error: 'У посиланні не може бути пробілів.' };
  if (BAD_PROTOCOLS.test(s)) return { ok: false, error: 'Такий тип посилання заборонено.' };
  if (/^(tel|sms):/i.test(s)) {
    const num = s.replace(/^(tel|sms):/i, '');
    return /^\+?[\d\-()]{3,20}$/.test(num) ? { ok: true, url: s.replace(/^(tel|sms):/i, (m) => m.toLowerCase()), kind: 'phone' } : { ok: false, error: 'Номер телефону виглядає неправильно.' };
  }
  if (/^mailto:/i.test(s)) {
    return /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(s) ? { ok: true, url: s, kind: 'mail' } : { ok: false, error: 'Адреса пошти виглядає неправильно.' };
  }
  if (!/^[^\W\d_][\w+.-]*:/.test(s)) s = `https://${s}`;
  let u;
  try { u = new URL(s); } catch { return { ok: false, error: 'Це не схоже на адресу сайту.' }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, error: 'Дозволено лише https, http, mailto, tel і sms.' };
  if (u.username || u.password) return { ok: false, error: 'Посилання з логіном і паролем заборонені.' };
  const host = u.hostname;
  if (!(host === 'localhost' || /^[^.]+(\.[^.]+)+$/.test(host)) || host.endsWith('.')) return { ok: false, error: 'У адресі немає коректного домену.' };
  return { ok: true, url: u.href, kind: 'web', host: host.replace(/^www\./, '') };
}

export function toolHost(url) {
  const r = checkUrl(url);
  if (!r.ok) return '';
  if (r.kind === 'phone') return url.replace(/^(tel|sms):/i, '');
  if (r.kind === 'mail') return url.replace(/^mailto:/i, '');
  return r.host;
}

// Одне слово — перша літера; кілька — ініціали перших двох слів.
export function glyphOf(t) {
  if (t.glyph) return t.glyph;
  const words = t.title.trim().split(/\s+/).filter(Boolean);
  const g = words.length > 1 ? [...words[0]][0] + [...words[1]][0] : [...(words[0] || '?')][0];
  return g.toUpperCase();
}

// Без пошуку й фільтра улюблені показуються окремо і не дублюються в категоріях.
export function toolView(tools, q = '', cat = '') {
  const n = q.trim().toLowerCase();
  const list = tools.filter((t) => (!cat || t.cat === cat) && (!n || t.title.toLowerCase().includes(n) || t.url.toLowerCase().includes(n)));
  const byTitle = (a, b) => a.title.localeCompare(b.title, 'uk');
  const plainView = !n && !cat;
  const fav = plainView ? list.filter((t) => t.fav).sort(byTitle) : [];
  const rest = plainView ? list.filter((t) => !t.fav) : list;
  return {
    fav,
    groups: TOOL_CATS.map((c) => ({ ...c, items: rest.filter((t) => t.cat === c.id).sort(byTitle) })).filter((g) => g.items.length),
    count: list.length,
  };
}

/* ---------- Перевірка збережених даних ---------- */

const plain = (o) => o && typeof o === 'object' && !Array.isArray(o);
const stamp = (v) => (Number.isFinite(+v) && +v > 0 ? +v : 0);
const okId = (v) => typeof v === 'string' && /^[\w-]{1,64}$/.test(v);

function cleanSteps(raw) {
  const out = [];
  const seen = new Set();
  for (const s of Array.isArray(raw) ? raw.slice(0, 40) : []) {
    const t = plain(s) && typeof s.t === 'string' ? s.t.trim().slice(0, 120) : '';
    if (!t) continue;
    let id = okId(s.id) ? s.id : uid();
    if (seen.has(id)) id = uid();
    seen.add(id);
    out.push({ id, t, req: s.req === true });
  }
  return out;
}

const sameTexts = (steps, texts) => steps.length === texts.length && steps.every((s, i) => s.t === texts[i]);

export function cleanDeck(raw) {
  const d = defaultDeck();
  if (!plain(raw)) return d;
  const runningSid = plain(raw.active) && okId(raw.active.sid) ? raw.active.sid : '';
  const scenarios = [];
  const ids = new Set();
  for (const s of Array.isArray(raw.scenarios) ? raw.scenarios : []) {
    if (!plain(s) || !KIND[s.kind]) continue;
    let title = typeof s.title === 'string' ? s.title.trim().slice(0, 60) : '';
    let id = okId(s.id) ? s.id : uid();
    if (ids.has(id)) id = uid();
    let steps = cleanSteps(s.steps);
    if (!title) continue;
    // Незмінені типові шаблони попередньої версії оновлюємо до нових.
    if (V2_TEXTS[s.kind] && id === `sc-${s.kind}` && runningSid !== id && sameTexts(steps, V2_TEXTS[s.kind])) {
      steps = templateSteps(s.kind);
      if (title === (V2_NAMES[s.kind] || KIND[s.kind].name)) title = KIND[s.kind].name;
    }
    if (s.kind === 'task') { steps = []; if (title === 'Несподіване доручення') title = KIND.task.name; }
    ids.add(id);
    scenarios.push({ id, kind: s.kind, title, steps });
  }
  // Вбудовані сценарії завжди присутні: якщо їх видалили з даних — повертаємо шаблон.
  for (const def of d.scenarios) if (!scenarios.some((s) => s.kind === def.kind && s.id === def.id)) scenarios.push(def);
  const order = ['med', 'tac', 'fire', 'go', 'task', 'custom'];
  scenarios.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const customs = scenarios.filter((s) => s.kind === 'custom');
  if (customs.length > CUSTOM_MAX) for (const c of customs.slice(CUSTOM_MAX)) scenarios.splice(scenarios.indexOf(c), 1);

  let active = null;
  const ra = raw.active;
  if (plain(ra) && okId(ra.sid) && scenarios.some((s) => s.id === ra.sid && s.kind !== 'task') && stamp(ra.startedAt)) {
    const checked = {};
    if (plain(ra.checked)) for (const [k, v] of Object.entries(ra.checked)) if (stamp(v)) checked[k] = stamp(v);
    const sc = scenarios.find((s) => s.id === ra.sid);
    active = { id: okId(ra.id) ? ra.id : uid(), sid: ra.sid, title: sc.title, kind: sc.kind, startedAt: stamp(ra.startedAt), finishedAt: 0, checked, note: typeof ra.note === 'string' ? ra.note.slice(0, 2000) : '', result: '' };
  }
  const runs = [];
  for (const r of Array.isArray(raw.runs) ? raw.runs.slice(0, RUNS_MAX) : []) {
    if (!plain(r) || !stamp(r.finishedAt) || !KIND[r.kind]) continue;
    runs.push({
      id: okId(r.id) ? r.id : uid(),
      sid: okId(r.sid) ? r.sid : '',
      title: typeof r.title === 'string' ? r.title.slice(0, 60) : KIND[r.kind].name,
      kind: r.kind,
      startedAt: stamp(r.startedAt) || stamp(r.finishedAt),
      finishedAt: stamp(r.finishedAt),
      checked: {},
      note: typeof r.note === 'string' ? r.note.slice(0, 2000) : '',
      result: r.result === 'done' ? 'done' : 'partial',
      total: Math.max(0, Math.round(+r.total) || 0),
      doneCount: Math.max(0, Math.round(+r.doneCount) || 0),
      reqTotal: Math.max(0, Math.round(+r.reqTotal) || 0),
      reqDone: Math.max(0, Math.round(+r.reqDone) || 0),
      missing: Array.isArray(r.missing) ? r.missing.filter((x) => typeof x === 'string').map((x) => x.slice(0, 120)).slice(0, 40) : [],
    });
  }
  runs.sort((a, b) => b.finishedAt - a.finishedAt);
  const favs = [];
  for (const f of Array.isArray(raw.favs) ? raw.favs : []) if (scenarios.some((s) => s.id === f) && !favs.includes(f) && favs.length < FAVS_MAX) favs.push(f);
  return { scenarios, active, runs, favs };
}

export function cleanTools(raw) {
  if (!Array.isArray(raw)) return defaultTools();
  const out = [];
  const seen = new Set();
  for (const t of raw.slice(0, 200)) {
    if (!plain(t)) continue;
    const title = typeof t.title === 'string' ? t.title.trim().slice(0, 40) : '';
    if (!title) continue;
    let id = okId(t.id) ? t.id : uid();
    if (seen.has(id)) id = uid();
    seen.add(id);
    out.push({
      id,
      title,
      url: typeof t.url === 'string' ? t.url.trim().slice(0, 2000) : '',
      cat: TOOL_CATS.some((c) => c.id === t.cat) ? t.cat : 'other',
      tone: TOOL_TONES.includes(t.tone) ? t.tone : 'blue',
      fav: t.fav === true,
      glyph: typeof t.glyph === 'string' ? [...t.glyph.trim()].slice(0, 2).join('') : '',
      icon: TOOL_ICONS.includes(t.icon) ? t.icon : '',
      createdAt: stamp(t.createdAt),
      usedAt: stamp(t.usedAt),
    });
  }
  return out;
}
