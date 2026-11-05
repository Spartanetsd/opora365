// ОПОРА 365 — компоненти дизайн-системи Obsidian Clarity (рядки HTML/SVG).
// Наступна дія, Пульс дня, рядки справ і «Не забути», статуси готовності, плитки сценаріїв, порожні стани.
import { esc, icon } from './ui.js';
import * as L from './logic.js';
import * as G from './logic-gear.js';

const TAU = Math.PI * 2;
const f1 = (n) => Math.round(n * 100) / 100;
function polar(cx, cy, r, deg) {
  const a = (deg - 90) * (Math.PI / 180);
  return [f1(cx + r * Math.cos(a)), f1(cy + r * Math.sin(a))];
}

/* ---------- Кільце прогресу ---------- */

// Попередні значення кілець — щоб анімувати лише реальну зміну.
const prevRing = new Map();

export function ring({ key, value = 0, total = 0, r = 50, w = 10, cx = 60, cy = 60, tone = 'mode' }) {
  const C = TAU * r;
  const frac = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;
  const from = prevRing.has(key) ? prevRing.get(key) : 0;
  prevRing.set(key, frac);
  return `<circle class="ring-track" cx="${cx}" cy="${cy}" r="${r}" stroke-width="${w}"/>
    <circle class="ring-val" data-tone="${tone}" cx="${cx}" cy="${cy}" r="${r}" stroke-width="${w}" stroke-dasharray="${f1(C)}" stroke-dashoffset="${f1(C * (1 - from))}" data-to="${f1(C * (1 - frac))}" transform="rotate(-90 ${cx} ${cy})"${frac === 0 ? ' opacity="0"' : ''}/>`;
}

export function miniRing({ key, value, total, dim = 44, tone = 'mode' }) {
  return `<svg class="mini-ring" width="${dim}" height="${dim}" viewBox="0 0 120 120" aria-hidden="true" focusable="false">${ring({ key, value, total, r: 48, w: 14, tone })}</svg>`;
}

// Після вставлення HTML: плавно довести кільця до нових значень.
export function animateRings(root) {
  const els = root.querySelectorAll('.ring-val[data-to]');
  if (!els.length) return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const el of els) {
      el.removeAttribute('opacity');
      el.style.strokeDashoffset = el.dataset.to;
    }
  }));
}

/* ---------- Наступна дія (на зображенні головного екрана) ---------- */

const PRIMARY = {
  step: 'Готово', ess: 'Перевірити речі', morning: 'Почати ранок', gearRun: 'Продовжити перевірку', deckRun: 'Продовжити',
  task: 'Виконано', must: 'Виконано', gear: 'Почати перевірку', evening: 'Підбити підсумок', backup: 'Створити копію',
};

export function nbaBlock(na, { more = false } = {}) {
  if (!na) {
    return `<div class="nba nba-calm">
      <p class="nba-lead">Зараз</p>
      <h2 class="nba-title" id="nbaTitle">Усе важливе під контролем</h2>
      <p class="nba-why">${icon('checkCircle')}<span>Невиконаних справ, перевірок і нагадувань немає.</span></p>
      <div class="nba-alt"><button type="button" class="btn btn-glass" data-act="openAdd">${icon('plus')}Додати справу</button></div>
    </div>`;
  }
  const blocked = na.kind === 'step' && na.blocked;
  const primary = blocked ? 'Відкрити крок' : na.kind === 'gear' && na.fix ? 'Відкрити' : PRIMARY[na.kind] || 'Відкрити';
  const ic = na.kind === 'task' || na.kind === 'must' || (na.kind === 'step' && !blocked) ? 'check' : 'arrow';
  return `<div class="nba" data-level="${na.level}" data-kind="${na.kind}">
    <p class="nba-lead"><span>${na.picked ? 'Ви обрали' : 'Зараз найважливіше'}</span>${na.at != null ? `<span class="nba-at">${L.fmtHM(na.at)}</span>` : ''}</p>
    <h2 class="nba-title" id="nbaTitle">${esc(na.title)}</h2>
    <p class="nba-why">${icon(na.level === 'warn' ? 'alert' : 'info')}<span>${esc(na.reason)}</span></p>
    <button type="button" class="btn btn-primary btn-xl btn-block nba-go" data-act="naDo" data-key="${esc(na.key)}">${icon(ic)}${primary}</button>
    ${na.defer || more ? `<div class="nba-alt">
      ${na.defer ? `<button type="button" class="btn btn-glass" data-act="naDefer" data-key="${esc(na.key)}">${icon('alarmClock')}Відкласти</button>` : ''}
      ${more ? `<button type="button" class="btn btn-glass" data-act="naOther">${icon('list')}Обрати іншу</button>` : ''}
    </div>` : ''}
  </div>`;
}

/* ---------- Пульс дня ---------- */

function pulseLine(p) {
  const W = 340, H = 50, pad = 8, base = 32;
  const firsts = [p.nowMin, ...p.events.map((e) => e.m), ...p.beats.map((b) => b.m)];
  const start = Math.max(0, Math.min(360, Math.floor(Math.min(...firsts) / 60) * 60));
  const end = 1440;
  const x = (m) => f1(pad + ((m - start) / (end - start)) * (W - pad * 2));
  let s = `<line class="pl-axis" x1="${pad}" y1="${base}" x2="${W - pad}" y2="${base}"/>`;
  s += `<line class="pl-past" x1="${pad}" y1="${base}" x2="${x(p.nowMin)}" y2="${base}"/>`;
  for (let h = Math.ceil(start / 180) * 3; h <= 24; h += 3) {
    const xx = x(h * 60);
    s += `<line class="pl-tick" x1="${xx}" y1="${base + 3}" x2="${xx}" y2="${base + 6}"/>`;
    if (h < 24) s += `<text class="pl-hour" x="${xx}" y="${H - 2}" text-anchor="middle">${String(h).padStart(2, '0')}</text>`;
  }
  for (const b of p.beats) s += `<rect class="pl-beat" data-k="${b.k}" x="${f1(x(b.m) - 1.25)}" y="${base - 15}" width="2.5" height="13" rx="1.25"/>`;
  for (const e of p.events) {
    const tone = e.kind === 'task' ? 'task' : 'morning';
    s += `<circle class="pl-ev pl-${tone}${e.done ? ' done' : ''}" cx="${x(e.m)}" cy="${base}" r="3.4"/>`;
  }
  s += `<line class="pl-now" x1="${x(p.nowMin)}" y1="${base - 20}" x2="${x(p.nowMin)}" y2="${base + 4}"/><circle class="pl-now-dot" cx="${x(p.nowMin)}" cy="${base - 20}" r="3"/>`;
  const beatsTxt = p.beats.length ? `виконано о ${p.beats.slice(-4).map((b) => L.fmtHM(b.m)).join(', ')}` : 'виконаних дій ще немає';
  const nextTxt = p.next ? `, далі ${L.fmtHM(p.next.t)} ${p.next.title}` : '';
  return `<svg class="pulse-line" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Ритм дня: ${esc(beatsTxt + nextTxt)}">${s}</svg>`;
}

export function pulseCard(p) {
  const label = p.total ? `Виконано ${p.done} з ${p.total} справ, ${p.pct} відсотків` : 'Справ на сьогодні немає';
  const sig = [];
  if (p.overdue) sig.push({ tone: 'coral', ic: 'alertCircle', html: `Прострочено <b>${p.overdue}</b>` });
  if (p.next) sig.push({ tone: 'blue', ic: 'clock', html: `<b>${L.fmtHM(p.next.t)}</b> ${esc(p.next.title)}` });
  if (p.prioOpen) sig.push({ tone: 'amber', ic: 'flag', html: `Пріоритети в роботі <b>${p.prioOpen}</b>` });
  if (p.checks) sig.push({ tone: 'teal', ic: 'shieldCheck', html: `Перевірки <b>${p.checks}</b>`, act: 'data-act="tab" data-tab="gear"' });
  return `<section class="pulse" aria-labelledby="pulseH">
    <div class="pulse-top">
      <div class="pulse-ring" role="img" aria-label="${esc(label)}">
        <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">${ring({ key: 'pulse', value: p.done, total: p.total, r: 50, w: 9, tone: 'teal' })}</svg>
        <span class="pulse-pct" aria-hidden="true">${p.pct == null ? '—' : `${p.pct}<small>%</small>`}</span>
      </div>
      <div class="pulse-body">
        <h2 class="pulse-h" id="pulseH">Пульс дня</h2>
        <p class="pulse-big">${p.total ? `Виконано ${p.done} з ${p.total}` : 'Справ на сьогодні немає'}</p>
        ${sig.length ? `<ul class="pulse-sig">${sig.slice(0, 3).map((x) => `<li data-tone="${x.tone}">${icon(x.ic)}<span>${x.html}</span></li>`).join('')}</ul>` : '<p class="pulse-quiet">Спокійний день без сигналів</p>'}
      </div>
    </div>
    ${pulseLine(p)}
  </section>`;
}

/* ---------- Шкала строку ---------- */

export function deadlineBar(info) {
  if (!info) return '';
  return `<span class="dl" data-level="${info.level}"><span class="dl-track"><span class="dl-fill" style="--f:${info.frac.toFixed(3)}"></span></span><span class="dl-text">${esc(info.text)}</span></span>`;
}

/* ---------- Рядок справи ---------- */

export function taskRow(t, today, { flash = '', nowMs = Date.now(), showDue = true } = {}) {
  const done = !!t.doneAt, cancelled = !!t.cancelledAt;
  const pr = L.PR[t.pr];
  const cat = t.cat ? L.TCAT[t.cat] : null;
  const meta = [];
  if (done) meta.push(`<span>виконано ${L.todayKey(t.doneAt) === today ? `о ${L.fmtHM(L.kyivParts(t.doneAt).min)}` : L.shortDate(L.todayKey(t.doneAt), today)}</span>`);
  else if (cancelled) meta.push(`<span>скасовано ${L.shortDate(L.todayKey(t.cancelledAt), today)}</span>`);
  else {
    meta.push(`<span class="pr" data-tone="${pr.tone}">${pr.short}</span>`);
    if (showDue && t.due > today) meta.push(`<span>${L.shortDate(t.due, today)}${t.time ? ` о ${t.time}` : ''}</span>`);
    if (!t.due) meta.push('<span>без дати</span>');
  }
  if (cat) meta.push(`<span class="meta-ic">${icon(cat.icon)}${esc(cat.name)}</span>`);
  if (!done && !cancelled) {
    if (t.rep) meta.push(`<span class="meta-ic">${icon('repeat')}${esc(L.repLabel(t.rep))}</span>`);
    const sp = L.subProgress(t);
    if (sp.total) meta.push(`<span>кроки ${sp.done}/${sp.total}</span>`);
  }
  const info = done || cancelled ? null : L.deadlineInfo(t, nowMs);
  const lead = cancelled
    ? `<span class="row-lead" aria-hidden="true">${icon('ban')}</span>`
    : `<button type="button" class="check${done ? ' on' : ''}" data-tone="${pr.tone}" role="checkbox" aria-checked="${done}" aria-label="${done ? 'Повернути в роботу' : 'Виконано'}: ${esc(t.title)}" data-act="toggleTask" data-id="${esc(t.id)}">${icon('check')}</button>`;
  return `<div class="row trow${done ? ' is-done' : ''}${cancelled ? ' is-cancelled' : ''}${flash === t.id ? ' flash' : ''}" data-tone="${pr.tone}">
    ${lead}
    <button type="button" class="row-main" data-act="openTask" data-id="${esc(t.id)}">
      <span class="row-title">${esc(t.title)}</span>
      <span class="row-meta">${meta.join('')}</span>
      ${deadlineBar(info)}
    </button>
  </div>`;
}

/* ---------- Рядок «Не забути» з явним рішенням ---------- */

export function mustRow(m, today, { flash = '', decide = true, nowMs = Date.now() } = {}) {
  const done = !!m.doneAt, cancelled = !!m.cancelledAt;
  const open = !done && !cancelled;
  const parked = open && !!m.returnOn && m.returnOn > today;
  const meta = [];
  if (done) meta.push(`виконано ${L.shortDate(L.todayKey(m.doneAt), today)}`);
  else if (cancelled) meta.push(`скасовано ${L.shortDate(L.todayKey(m.cancelledAt), today)}`);
  else if (parked) meta.push(`перенесено, повернеться ${L.shortDate(m.returnOn, today)}`);
  else {
    const age = Math.max(0, L.diffDays(L.todayKey(m.createdAt), today));
    meta.push(age === 0 ? 'додано сьогодні' : `у списку ${L.daysWord(age)}`);
  }
  if (m.note) meta.push(esc(m.note.split('\n')[0].slice(0, 60)));
  const info = open && !parked ? L.deadlineInfo(m, nowMs, 'must') : null;
  const t = esc(m.title);
  return `<div class="row mrow${done ? ' is-done' : ''}${cancelled ? ' is-cancelled' : ''}${parked ? ' is-parked' : ''}${flash === m.id ? ' flash' : ''}">
    <span class="row-lead mrow-pin" aria-hidden="true">${icon(done ? 'checkCircle' : cancelled ? 'ban' : 'pin')}</span>
    <div class="mrow-body">
      <button type="button" class="row-main" data-act="openMust" data-id="${esc(m.id)}">
        <span class="row-title">${t}</span>
        <span class="row-meta">${meta.map((x) => `<span>${x}</span>`).join('')}</span>
        ${deadlineBar(info)}
      </button>
    </div>
    ${open && decide ? `<div class="decide" role="group" aria-label="Рішення: ${t}">
      <button type="button" class="dbtn" data-tone="teal" data-act="mustDone" data-id="${esc(m.id)}">${icon('check')}<span>Виконати</span></button>
      <button type="button" class="dbtn" data-act="mustMove" data-id="${esc(m.id)}">${icon('calendarMove')}<span>Перенести</span></button>
      <button type="button" class="dbtn" data-act="mustCancel" data-id="${esc(m.id)}">${icon('ban')}<span>Скасувати</span></button>
    </div>` : ''}
  </div>`;
}

/* ---------- Статуси готовності ---------- */

export function itemChip(st) {
  const d = G.ITEM_ST[st.s];
  return `<span class="st-chip" data-tone="${d.tone}">${icon(d.icon)}<span>${esc(d.name)}</span></span>`;
}
export function catChip(s, text = '') {
  const d = G.STATUS[s];
  return `<span class="st-chip" data-tone="${d.tone}">${icon(d.icon)}<span>${esc(text || d.short)}</span></span>`;
}

/* ---------- Пункт чекліста ---------- */

export function checklistItem({ id, text, on, act, req = false, meta = '', note = '' }) {
  return `<button type="button" class="cl-item${on ? ' on' : ''}" role="checkbox" aria-checked="${on}" data-act="${act}" data-id="${esc(id)}">
    <span class="check${on ? ' on' : ''}" aria-hidden="true">${icon('check')}</span>
    <span class="cl-main"><span class="cl-text">${esc(text)}</span>${req || meta ? `<span class="cl-meta">${req ? `<span class="req">${icon('shield')}обовʼязково</span>` : ''}${meta ? esc(meta) : ''}</span>` : ''}${note ? `<span class="cl-note">${esc(note)}</span>` : ''}</span>
  </button>`;
}

/* ---------- Плитка сценарію ---------- */

export function quickTile({ kind, sc = null, run = null, count = 0, fav = false }) {
  const k = kind;
  const steps = sc ? sc.steps.length : 0;
  const req = sc ? sc.steps.filter((s) => s.req).length : 0;
  let foot;
  if (k.id === 'task') foot = 'Швидка форма';
  else if (k.id === 'custom' && !sc) foot = count ? `${count} ${L.plural(count, ['сценарій', 'сценарії', 'сценаріїв'])}` : 'Створити';
  else foot = `${steps} ${L.plural(steps, ['крок', 'кроки', 'кроків'])}${req ? `, обовʼязкових ${req}` : ''}`;
  return `<button type="button" class="qtile" data-tone="${k.tone}" data-act="deckOpen" data-kind="${k.id}"${sc ? ` data-id="${esc(sc.id)}"` : ''} aria-label="${esc(sc && k.id !== 'custom' ? sc.title : k.name)}. ${esc(k.desc)}${run ? '. Триває' : ''}${fav ? '. В обраному' : ''}">
    <span class="qt-ic" aria-hidden="true">${icon(k.icon)}</span>
    <span class="qt-title">${esc(sc && k.id !== 'custom' ? sc.title : k.name)}</span>
    <span class="qt-desc">${esc(k.desc)}</span>
    <span class="qt-foot">${foot}${run ? `<span class="qt-live">${icon('play')}триває</span>` : ''}${fav ? `<span class="qt-fav" aria-hidden="true">${icon('star')}</span>` : ''}</span>
  </button>`;
}

/* ---------- Режим дня ---------- */

export function modeChip(mi) {
  const m = L.MODE[mi.id];
  return `<button type="button" class="mode-chip" data-tone="${m.tone}" data-act="openMode" aria-label="Режим дня: ${esc(m.name)}${mi.manual ? '' : ', автоматично'}. Змінити">
    <span class="mode-dot" aria-hidden="true"></span><span>${esc(m.name)}</span>${mi.manual ? '' : '<span class="mode-auto">авто</span>'}${icon('down')}
  </button>`;
}

/* ---------- Заголовок на зображенні ---------- */

export function photoHead({ title, sub = '', extra = '' }) {
  return `<header class="ph">
    <div class="ph-text"><h1 class="ph-title" data-title-anchor>${esc(title)}</h1>${sub ? `<p class="ph-sub">${sub}</p>` : ''}</div>
    ${extra}
  </header>`;
}

/* ---------- Порожні стани й помилки ---------- */

// Ілюстрації декоративні (alt=""): увесь зміст — у тексті поруч.
export function emptyState({ ic = 'check', img = '', title, text = '', action = '' }) {
  if (img) {
    return `<div class="empty has-img">
      <div class="empty-fig" aria-hidden="true"><img src="${esc(img)}" alt="" loading="lazy" decoding="async"></div>
      <div class="empty-body"><p class="empty-t">${esc(title)}</p>${text ? `<p class="empty-x">${esc(text)}</p>` : ''}${action}</div>
    </div>`;
  }
  return `<div class="empty"><span class="empty-ic" aria-hidden="true">${icon(ic)}</span><p class="empty-t">${esc(title)}</p>${text ? `<p class="empty-x">${esc(text)}</p>` : ''}${action}</div>`;
}

export function errorState({ title = 'Не вдалося показати екран', text = 'Дані в безпеці: помилка стосується лише показу цього екрана.', detail = '' } = {}) {
  return `<div class="error-state" role="alert">
    <span class="empty-ic" aria-hidden="true">${icon('alert')}</span>
    <p class="empty-t">${esc(title)}</p>
    <p class="empty-x">${esc(text)}</p>
    ${detail ? `<p class="err-detail">${esc(detail)}</p>` : ''}
    <div class="row2"><button type="button" class="btn btn-tinted" data-act="tab" data-tab="home">${icon('sun')}На головну</button><button type="button" class="btn btn-quiet" data-act="reload">${icon('reset')}Оновити</button></div>
  </div>`;
}

export function sectionHead(title, { countN = null, action = '', id = '' } = {}) {
  return `<div class="sec-row"><h2 class="sec-h"${id ? ` id="${id}"` : ''}>${esc(title)}${countN != null ? `<span class="sec-count">${countN}</span>` : ''}</h2>${action}</div>`;
}
