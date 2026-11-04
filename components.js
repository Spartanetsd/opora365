// ОПОРА 365 — компоненти дизайн-системи Obsidian Flow (рядки HTML/SVG).
// HeroCard, PriorityCard, Timeline, ProgressRing/Orb, StatusSegment, ChecklistItem,
// QuickActionTile, ModeSwitcher, EmptyState, ErrorState, DeadlineBar.
import { esc, icon } from './ui.js';
import * as L from './logic.js';

const TAU = Math.PI * 2;
const f1 = (n) => Math.round(n * 100) / 100;
function polar(cx, cy, r, deg) {
  const a = (deg - 90) * (Math.PI / 180);
  return [f1(cx + r * Math.cos(a)), f1(cy + r * Math.sin(a))];
}
export function arcPath(cx, cy, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${x0} ${y0}A${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

/* ---------- ProgressRing / Day Orb ---------- */

// Попередні значення кілець — щоб анімувати лише реальну зміну.
const prevRing = new Map();
const prevSegs = new Map();

// Кільце прогресу: суцільне (value/total) або сегментоване (масив станів).
export function ring({ key, value = 0, total = 0, segs = null, r = 112, w = 14, cx = 150, cy = 150, tone = 'mode', clickable = null, labels = null, icons = null }) {
  const C = TAU * r;
  let out = `<circle class="ring-track" cx="${cx}" cy="${cy}" r="${r}" stroke-width="${w}"/>`;
  if (segs && segs.length) {
    const n = segs.length;
    const gap = n > 1 ? Math.min(7, 70 / n) : 0;
    const span = 360 / n;
    const before = prevSegs.get(key) || [];
    segs.forEach((s, i) => {
      const a0 = i * span + gap / 2, a1 = (i + 1) * span - gap / 2;
      const fresh = before.length === n && before[i] !== s && (s === 'done' || s === 'ok') ? ' pop' : '';
      const d = arcPath(cx, cy, r, a0, a1);
      const label = labels ? labels[i] : '';
      const tag = clickable ? `<g class="rs-hit" role="button" tabindex="0" data-act="${clickable.act}" data-id="${esc(clickable.ids[i])}" aria-label="${esc(label)}">` : '<g>';
      let extra = '';
      if (s && typeof s === 'object') {
        // { s: 'running', f: 0.4 } — частково заповнений сегмент
        const part = a0 + (a1 - a0) * Math.max(0, Math.min(1, s.f));
        extra = `<path class="rs rs-todo" d="${d}" stroke-width="${w}"/>${s.f > 0 ? `<path class="rs rs-running" d="${arcPath(cx, cy, r, a0, part)}" stroke-width="${w}"/>` : ''}`;
      } else {
        extra = `<path class="rs rs-${s}${fresh}" d="${d}" stroke-width="${w}"/>`;
      }
      let glyph = '';
      if (icons && icons[i]) {
        const [gx, gy] = polar(cx, cy, r, (a0 + a1) / 2);
        glyph = `<g class="rs-ic" transform="translate(${f1(gx - 9)} ${f1(gy - 9)}) scale(.75)">${icon(icons[i], 'rs-glyph').replace('<svg ', '<svg width="24" height="24" ')}</g>`;
      }
      out += `${tag}${clickable ? `<path class="rs-pad" d="${d}" stroke-width="${w + 22}"/>` : ''}${extra}${glyph}</g>`;
    });
    prevSegs.set(key, segs.map((s) => (typeof s === 'object' ? s.s : s)));
  } else {
    const frac = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;
    const from = prevRing.has(key) ? prevRing.get(key) : 0;
    prevRing.set(key, frac);
    out += `<circle class="ring-val ring-${tone}" cx="${cx}" cy="${cy}" r="${r}" stroke-width="${w}" stroke-dasharray="${f1(C)}" stroke-dashoffset="${f1(C * (1 - from))}" data-to="${f1(C * (1 - frac))}" transform="rotate(-90 ${cx} ${cy})"${frac === 0 ? ' opacity="0"' : ''}/>`;
  }
  return out;
}

// Безель доби: 24 години, події дня і поточний час — реальні дані, не прикраса.
function dial(cx, cy, r, events, nowMin) {
  let s = '';
  for (let h = 0; h < 24; h++) {
    const major = h % 6 === 0;
    const [x0, y0] = polar(cx, cy, r - (major ? 7 : 3.5), h * 15);
    const [x1, y1] = polar(cx, cy, r, h * 15);
    s += `<line class="tick${major ? ' major' : ''}" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"/>`;
  }
  for (const e of events) {
    const [x, y] = polar(cx, cy, r + 8, (L.minOfDay(e.t) / 1440) * 360);
    s += `<circle class="ev-dot ev-${e.kind}${e.done ? ' done' : ''}" cx="${x}" cy="${y}" r="2.6"/>`;
  }
  const [nx, ny] = polar(cx, cy, r + 8, (nowMin / 1440) * 360);
  s += `<circle class="now-glow" cx="${nx}" cy="${ny}" r="8"/><circle class="now-dot" cx="${nx}" cy="${ny}" r="3.6"/>`;
  return s;
}

export function dayOrb(orb, { events = [], nowMin = 0, label = '' } = {}) {
  const segs = orb.segs && orb.segs.length && orb.segs.length <= 16 ? orb.segs : null;
  const mode = L.MODE[orb.mode];
  const phase = -((typeof performance !== 'undefined' ? performance.now() : 0) / 1000) % 7;
  return `<div class="orb" data-level="${orb.level}" role="img" aria-label="${esc(label)}">
    <div class="orb-halo" style="animation-delay:${phase.toFixed(2)}s" aria-hidden="true"></div>
    <svg class="orb-svg" viewBox="0 0 300 300" aria-hidden="true" focusable="false">
      <g class="dial">${dial(150, 150, 136, events, nowMin)}</g>
      ${ring({ key: `orb-${orb.mode}`, value: orb.value, total: orb.total, segs, r: 112, w: 13 })}
    </svg>
    <div class="orb-center" aria-hidden="true">
      <span class="orb-mode">${icon(mode.icon)}${esc(mode.name)}</span>
      <span class="orb-big${orb.isTime ? ' is-time' : ''}">${esc(orb.big)}</span>
      <span class="orb-cap">${esc(orb.caption)}</span>
    </div>
  </div>`;
}

// Невелике кільце для карток і заголовків (наприклад, прогрес сценарію).
export function miniRing({ key, value, total, dim = 44, tone = 'mode' }) {
  return `<svg class="mini-ring" width="${dim}" height="${dim}" viewBox="0 0 300 300" aria-hidden="true" focusable="false">${ring({ key, value, total, r: 120, w: 34, tone })}</svg>`;
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

/* ---------- HeroCard: «Твоя наступна дія» ---------- */

const PRIMARY = {
  step: 'Готово', morning: 'Почати ранок', gearRun: 'Продовжити перевірку', deckRun: 'Продовжити',
  task: 'Виконано', must: 'Виконано', gear: 'Почати перевірку', plan: 'Відкрити ранок', backup: 'Створити копію',
};

export function heroCard(na, { then = null } = {}) {
  if (!na) {
    return `<section class="hero hero-empty" aria-labelledby="heroTitle">
      <span class="eyebrow">Твоя наступна дія</span>
      <h2 class="hero-title" id="heroTitle">Усе під контролем</h2>
      <p class="hero-reason">Невиконаних справ, перевірок і нагадувань зараз немає.</p>
      <button type="button" class="btn btn-tinted btn-lg btn-block" data-act="openAdd">${icon('plus')}Додати справу</button>
    </section>`;
  }
  const primary = na.kind === 'gear' && na.title.startsWith('Усунути') ? 'Відкрити' : PRIMARY[na.kind] || 'Відкрити';
  const blocked = na.kind === 'step' && na.blocked;
  const canPr = na.kind === 'task' || na.kind === 'must';
  return `<section class="hero" data-level="${na.level}" data-kind="${na.kind}" aria-labelledby="heroTitle">
    <div class="hero-top">
      <span class="eyebrow">Твоя наступна дія</span>
      ${na.at != null ? `<span class="hero-time">${L.fmtHM(na.at)}</span>` : ''}
    </div>
    <div class="hero-main">
      <span class="hero-ic" aria-hidden="true">${icon(na.icon || 'arrow')}</span>
      <h2 class="hero-title" id="heroTitle">${esc(na.title)}</h2>
    </div>
    <p class="hero-reason">${na.level === 'warn' ? icon('alert') : ''}<span>${esc(na.reason)}</span></p>
    <button type="button" class="btn btn-primary btn-xl btn-block hero-go" data-act="naDo" data-key="${esc(na.key)}">${icon(na.kind === 'task' || na.kind === 'must' || (na.kind === 'step' && !blocked) ? 'check' : 'arrow')}${blocked ? 'Відкрити крок' : primary}</button>
    ${na.defer || canPr ? `<div class="hero-alt">
      ${na.defer ? `<button type="button" class="btn btn-quiet" data-act="naDefer" data-key="${esc(na.key)}">${icon('alarmClock')}Відкласти</button>` : ''}
      ${canPr ? `<button type="button" class="btn btn-quiet" data-act="naPriority" data-key="${esc(na.key)}">${icon('flag')}Пріоритет</button>` : ''}
    </div>` : ''}
    ${then ? `<p class="hero-then"><span>Потім</span>${esc(then.title)}</p>` : ''}
  </section>`;
}

/* ---------- DeadlineBar ---------- */

export function deadlineBar(info) {
  if (!info) return '';
  return `<span class="dl" data-level="${info.level}"><span class="dl-track"><span class="dl-fill" style="--f:${info.frac.toFixed(3)}"></span></span><span class="dl-text">${esc(info.text)}</span></span>`;
}

/* ---------- PriorityCard ---------- */

export function priorityCard(t, { today, layer = 'top', flash = '', nowMs = Date.now() } = {}) {
  const pr = L.PR[t.pr];
  const cat = t.cat ? L.TCAT[t.cat] : null;
  const done = !!t.doneAt;
  const meta = [];
  if (layer !== 'main') meta.push(`<span class="pr" data-tone="${pr.tone}">${pr.short}</span>`);
  if (t.rep) meta.push(`<span class="meta-rep">${icon('repeat')}${esc(L.repLabel(t.rep))}</span>`);
  const sp = L.subProgress(t);
  if (sp.total) meta.push(`<span>кроки ${sp.done}/${sp.total}</span>`);
  if (t.moved) meta.push(`<span>перенесено: ${t.moved}</span>`);
  const info = done ? null : L.deadlineInfo(t, nowMs);
  return `<article class="pcard${done ? ' is-done' : ''}${flash === t.id ? ' flash' : ''}" data-tone="${pr.tone}" data-layer="${layer}">
    <button type="button" class="check check-lg${done ? ' on' : ''}" data-tone="${pr.tone}" role="checkbox" aria-checked="${done}" aria-label="${done ? 'Повернути' : 'Виконано'}: ${esc(t.title)}" data-act="toggleTask" data-id="${esc(t.id)}">${icon('check')}</button>
    <button type="button" class="pcard-main" data-act="openTask" data-id="${esc(t.id)}">
      <span class="pcard-top">${cat ? `<span class="pcard-cat">${icon(cat.icon)}${esc(cat.name)}</span>` : ''}${layer === 'main' ? `<span class="pr" data-tone="${pr.tone}">${pr.name}</span>` : ''}</span>
      <span class="pcard-title">${esc(t.title)}</span>
      ${meta.length ? `<span class="pcard-meta">${meta.join('')}</span>` : ''}
      ${deadlineBar(info)}
    </button>
    ${layer === 'main' && !done ? `<button type="button" class="pcard-focus" data-act="focusOpen" data-id="${esc(t.id)}" aria-label="Режим «Фокус»">${icon('focus')}</button>` : ''}
  </article>`;
}

/* ---------- Timeline: горизонтальна хронологія дня ---------- */

export function dayline(ev, { compact = false } = {}) {
  const PPM = compact ? 1.25 : 1.5;
  const W = Math.round((ev.end - ev.start) * PPM);
  const x = (t) => Math.round((t - ev.start) * PPM);
  let ticks = '';
  for (let t = ev.start; t <= ev.end; t += 60) ticks += `<span class="tl-hour" style="left:${x(t)}px">${L.fmtHM(t).slice(0, 2)}</span>`;
  const lanes = [];
  const items = ev.events.map((e) => {
    const px = x(e.t);
    let lane = 0;
    while (lanes[lane] !== undefined && lanes[lane] > px - 6) lane++;
    lanes[lane] = px + 120;
    const tone = e.kind === 'task' ? L.PR[e.pr].tone : 'amber';
    const label = `${L.fmtHM(e.t)} ${e.title}${e.done ? ', минуло' : ''}`;
    const act = e.kind === 'task' ? `data-act="openTask" data-id="${esc(e.id)}"` : 'data-act="tab" data-tab="morning"';
    return `<button type="button" class="tl-ev${e.done ? ' done' : ''}" data-tone="${tone}" data-lane="${Math.min(lane, 2)}" style="left:${px}px" ${act} role="listitem" aria-label="${esc(label)}">
      <span class="tl-dot" aria-hidden="true"></span><span class="tl-lbl"><b>${L.fmtHM(e.t)}</b>${esc(e.title)}</span></button>`;
  }).join('');
  const lanesUsed = Math.min(3, Math.max(1, lanes.length));
  return `<div class="dayline" data-lanes="${lanesUsed}" data-now="${x(ev.now)}">
    <div class="dl-scroll" tabindex="0" aria-label="Хронологія дня">
      <div class="dl-canvas" style="width:${W}px" role="list">
        <div class="dl-axis" aria-hidden="true"><span class="dl-past" style="width:${Math.max(0, Math.min(W, x(ev.now)))}px"></span></div>
        ${ev.now >= ev.start && ev.now <= ev.end ? `<span class="tl-now" style="left:${x(ev.now)}px" aria-hidden="true"><span>${L.fmtHM(ev.now)}</span></span>` : ''}
        ${ticks}${items}
      </div>
    </div>
  </div>`;
}

export function scrollDaylines(root) {
  for (const d of root.querySelectorAll('.dayline')) {
    const sc = d.querySelector('.dl-scroll');
    if (!sc || sc.dataset.done) continue;
    sc.dataset.done = '1';
    sc.scrollLeft = Math.max(0, +d.dataset.now - sc.clientWidth * 0.35);
  }
}

/* ---------- StatusSegment ---------- */

const ST_ICON = { ok: 'checkCircle', issues: 'alertCircle', needs: 'circleDash', running: 'half' };
const ST_NAME = { ok: 'Без недоліків', issues: 'Є недоліки', needs: 'Потребує перевірки', running: 'Перевірка триває' };
export function statusBadge(s, text = '') {
  return `<span class="status" data-s="${s}">${icon(ST_ICON[s])}<span>${esc(text || ST_NAME[s])}</span></span>`;
}

/* ---------- ChecklistItem ---------- */

export function checklistItem({ id, text, on, act, req = false, meta = '', note = '' }) {
  return `<button type="button" class="cl-item${on ? ' on' : ''}" role="checkbox" aria-checked="${on}" data-act="${act}" data-id="${esc(id)}">
    <span class="check${on ? ' on' : ''}" aria-hidden="true">${icon('check')}</span>
    <span class="cl-main"><span class="cl-text">${esc(text)}</span>${req || meta ? `<span class="cl-meta">${req ? `<span class="req">${icon('shield')}обовʼязково</span>` : ''}${meta ? esc(meta) : ''}</span>` : ''}${note ? `<span class="cl-note">${esc(note)}</span>` : ''}</span>
  </button>`;
}

/* ---------- QuickActionTile ---------- */

export function quickTile({ kind, sc, run = null, count = 0 }) {
  const k = kind;
  const steps = sc ? sc.steps.length : count;
  const req = sc ? sc.steps.filter((s) => s.req).length : 0;
  const live = run ? `<span class="qt-live">${icon('play')}триває</span>` : '';
  return `<button type="button" class="qtile" data-tone="${k.tone}" data-act="deckOpen" data-kind="${k.id}"${sc ? ` data-id="${esc(sc.id)}"` : ''} aria-label="${esc(k.name)}. ${esc(k.desc)}">
    <span class="qt-glow" aria-hidden="true"></span>
    <span class="qt-ic">${icon(k.icon)}</span>
    <span class="qt-title">${esc(sc && k.id !== 'custom' ? sc.title : k.name)}</span>
    <span class="qt-desc">${esc(k.desc)}</span>
    <span class="qt-foot">${k.id === 'custom' && !sc ? `${count ? `${count} ${L.plural(count, ['сценарій', 'сценарії', 'сценаріїв'])}` : 'Створити'}` : `${steps} ${L.plural(steps, ['крок', 'кроки', 'кроків'])}${req ? ` · ${req} обовʼяз.` : ''}`}${live}</span>
  </button>`;
}

/* ---------- ModeSwitcher ---------- */

export function modeChip(mi) {
  const m = L.MODE[mi.id];
  return `<button type="button" class="mode-chip" data-tone="${m.tone}" data-act="openMode" aria-label="Режим: ${esc(m.name)}${mi.manual ? '' : ', автоматично'}. Змінити">
    <span class="mode-dot" aria-hidden="true"></span><span>${esc(m.name)}</span>${mi.manual ? '' : '<span class="mode-auto">авто</span>'}${icon('down')}
  </button>`;
}

/* ---------- EmptyState / ErrorState ---------- */

export function emptyState({ ic = 'check', title, text = '', action = '' }) {
  return `<div class="empty"><span class="empty-ic">${icon(ic)}</span><p class="empty-t">${esc(title)}</p>${text ? `<p class="empty-x">${esc(text)}</p>` : ''}${action}</div>`;
}

export function errorState({ title = 'Щось пішло не так', text = 'Дані в безпеці — помилка стосується лише показу цього екрана.', detail = '' } = {}) {
  return `<div class="error-state" role="alert">
    <span class="empty-ic">${icon('alert')}</span>
    <p class="empty-t">${esc(title)}</p>
    <p class="empty-x">${esc(text)}</p>
    ${detail ? `<p class="err-detail">${esc(detail)}</p>` : ''}
    <div class="row2"><button type="button" class="btn btn-tinted" data-act="tab" data-tab="home">${icon('orb')}На головну</button><button type="button" class="btn btn-quiet" data-act="reload">${icon('reset')}Оновити</button></div>
  </div>`;
}

export function sectionHead(title, { countN = null, action = '', id = '' } = {}) {
  return `<div class="sec-row"><h2 class="sec-h"${id ? ` id="${id}"` : ''}>${esc(title)}${countN != null ? `<span class="sec-count">${countN}</span>` : ''}</h2>${action}</div>`;
}
