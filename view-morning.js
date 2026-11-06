// ОПОРА 365 — «Мій ранок»: Morning Flow 2.0. Шаблони дня, автоматичний розрахунок підйому,
// зворотний відлік до виходу, шкала кроків, режим запізнення і «Вихід без забутого».
import * as L from './logic.js';
import { esc, icon, seg, openSheet, closeSheet, confirmSheet, toast, sheetHead, stepper, haptic } from './ui.js';
import { photoHead } from './components.js';
import { startQueue } from './view-gear.js';

const clamp = (v, lo, hi, d) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const tplOf = (app) => L.currentTpl(app.state);
// Число й одиниця не розриваються між рядками: «5 хв», «1 год».
const nb = (s) => esc(s).replace(/(\d) (хв|год)/g, '$1&nbsp;$2');
// Назва кроку зі щитом «критичний»: щит не переноситься на окремий рядок, а лишається з останнім словом.
const critTitle = (title, crit) => {
  const t = esc(title);
  if (!crit) return t;
  const i = t.lastIndexOf(' ');
  return `${t.slice(0, i + 1)}<span class="nowrap">${t.slice(i + 1)}${icon('shield', 'crit')}</span>`;
};
// Локальні хвилини → мітка часу (для живого відліку).
const msAt = (localM, nowMs) => Math.round(nowMs + (localM - L.localMin(nowMs)) * 60000);

// Один рядок стану. Числа беруться з тих самих цілих хвилин, що й шкала: «06:35» і «на 5 хв» завжди сходяться.
function levelInfo(st, end) {
  if (st.level === 'ok') return { level: 'ok', ic: 'checkCircle', text: st.spare ? `У графіку, запас ${L.fmtDur(st.spare)}` : 'У графіку, без запасу' };
  if (st.level === 'tight') return { level: 'tight', ic: 'clock', text: `Часу обмаль: бракує ${L.fmtDur(-st.spare)}` };
  return { level: 'late', ic: 'clock', text: `Орієнтовно о ${L.fmtHM(st.expected)}, на ${L.fmtDur(-st.spare)} пізніше` };
}

/* ---------- Верхня частина: час виходу й відлік ---------- */

function bigBlock(app, sm, st, nowMs) {
  const p = sm.plan;
  const end = L.endLabel(sm.tpl);
  let count = '', pill = '';
  const depMs = msAt(sm.depAt, nowMs);
  const toWhat = end === 'Вихід' ? 'виходу' : 'початку дня';
  const countdown = () => `<p class="m-count">До ${toWhat} <b class="tnum" data-count-to="${depMs}">${L.fmtClock((depMs - nowMs) / 1000)}</b></p>`;
  if (sm.phase === 'running' && st) {
    count = st.toDep > 0 ? countdown() : `<p class="m-count is-late">${end} за планом був о ${L.fmtHM(p.departure)}</p>`;
    const info = levelInfo(st, end);
    pill = `<p class="pill" data-level="${info.level}">${icon(info.ic)}<span>${nb(info.text)}</span></p>`;
  } else if (sm.phase === 'finished') {
    const diff = sm.depAt - L.clockMin(L.localMin(sm.session.finishedAt));
    count = sm.toDep > 0 ? countdown() : '';
    pill = `<p class="pill" data-level="ok">${icon('checkCircle')}Готові${diff > 0 ? `, запас ${L.fmtDur(diff)}` : ''}</p>`;
  } else if (sm.phase === 'window') {
    count = countdown();
  } else if (sm.phase === 'after') {
    count = `<p class="m-count">${end} був о ${L.fmtHM(p.departure)}</p>`;
  } else {
    count = `<p class="m-count">Підйом ${L.relIn(sm.toWake)}</p>`;
  }
  return `<div class="m-big" data-level="${st && st.level !== 'ok' ? st.level : 'normal'}">
    <p class="m-big-l">${esc(end)}${sm.rel === 1 ? ', завтра' : ''}</p>
    <p class="m-time tnum">${L.fmtHM(p.departure)}</p>
    ${count}
    ${pill}
  </div>`;
}

function tplChips(app, sm) {
  const running = sm.phase === 'running' || sm.phase === 'finished';
  const cur = sm.tpl.id;
  const chips = app.state.morning.templates.map((t) => {
    const k = L.TPL_KIND[t.kind];
    return `<button type="button" class="chip tpl-chip" role="radio" aria-checked="${t.id === cur}" aria-pressed="${t.id === cur}" data-act="tplPick" data-id="${esc(t.id)}">${icon(k.icon)}${esc(t.name)}</button>`;
  }).join('');
  const customs = app.state.morning.templates.filter((t) => t.kind === 'custom').length;
  return `<div class="chips tpl-chips" role="radiogroup" aria-label="Сценарій ранку">${chips}${customs < L.TPL_CUSTOM_MAX && !running ? `<button type="button" class="chip plain" data-act="tplNew" aria-label="Новий власний шаблон">${icon('plus')}Власний</button>` : ''}</div>`;
}

function facts(sm) {
  const t = sm.tpl, p = sm.plan;
  const home = L.homeDay(t);
  return `<button type="button" class="facts" data-act="openRoute" aria-label="Маршрут і час: змінити">
    <span>${icon('sunrise')}Підйом <b class="tnum">${L.fmtHM(p.wake)}</b>${p.wakePrevDay ? ' (напередодні)' : ''}</span>
    ${home ? '' : `<span>${icon(L.TR[t.transport].icon)}${esc(L.TR[t.transport].name)}${p.travel ? ` <b>${p.travel} хв</b>` : ''}</span>`}
    <span>${icon('clock')}${p.buffer ? `Запас <b>${p.buffer} хв</b>` : 'Без запасу'}</span>
    <span>${icon('flag')}${home ? 'Справи з' : 'Прибуття'} <b class="tnum">${esc(t.arrival)}</b></span>
    <span class="facts-edit">${icon('sliders')}</span>
  </button>`;
}

// Короткий сценарій: що зміниться в режимі «Часу обмаль» (реальні тривалості кроків).
function lateCard(st, end) {
  if (st.finished || st.level === 'ok') return '';
  if (!st.short) {
    const rows = st.rows.filter((r) => r.state === 'todo' && !r.critical && r.short < r.min);
    if (!rows.length) return '';
    const can = st.level === 'tight';
    return `<section class="late-card" aria-label="Режим запізнення">
      <h3>${icon('clock')}Режим запізнення</h3>
      <p>${can ? `Мінімальний набір кроків вкладається в час${st.altSpare ? `: запас ${L.fmtDur(st.altSpare)}` : ''}.` : `Навіть мінімальний набір не встигає, але скоротить запізнення з ${L.fmtDur(-st.spare)} до ${L.fmtDur(-st.altSpare)}.`} Критичні кроки не скорочуються.</p>
      <ul>${rows.map((r) => `<li><span>${esc(r.title)}</span><span>${r.short === 0 ? 'пропустити' : `${r.min} → ${r.short} хв`}</span></li>`).join('')}</ul>
      <button type="button" class="btn btn-primary btn-block" data-tone="amber" data-act="shortOn">Увімкнути «Часу обмаль»</button>
    </section>`;
  }
  return `<section class="late-card" aria-label="Запізнення">
    <h3>${icon('clock')}${esc(end)} орієнтовно о ${L.fmtHM(st.expected)}</h3>
    <p>Скорочено все, що можна. Якщо запізнення важливе — попередьте заздалегідь і продовжуйте у своєму темпі.</p>
  </section>`;
}

/* ---------- Вертикальна шкала ---------- */

function currentCard(app, st) {
  const c = st.current;
  const ss = app.state.session;
  const checks = ss.checks[c.id] || [];
  const blocked = c.items.length > 0 && c.items.some((_, i) => !checks.includes(i));
  const items = c.items.length ? `<div class="subchecks">${c.items.map((it, i) => {
    const on = checks.includes(i);
    return `<button type="button" class="subcheck" role="checkbox" aria-checked="${on}" data-act="subCheck" data-id="${esc(c.id)}" data-i="${i}"><span class="check${on ? ' on' : ''}" data-tone="amber" aria-hidden="true">${icon('check')}</span><span>${esc(it)}</span></button>`;
  }).join('')}</div>` : '';
  let extra = '';
  if (c.kind === 'tasks') {
    const focus = L.taskView(app.state.tasks, app.today, app.state.pin).focus;
    extra = `<div class="now-tasks">${focus.length ? focus.map((t) => `<p><span class="dot" data-tone="${L.PR[t.pr].tone}"></span>${esc(t.title)}</p>`).join('') : '<p class="muted">На сьогодні справ немає.</p>'}</div>`;
  } else if (c.kind === 'gear') {
    extra = `<button type="button" class="btn btn-tinted btn-block" style="margin-top:12px" data-act="mGearCheck">${icon('shieldCheck')}Перевірка перед чергуванням</button>`;
  }
  // «Ще 4 хв, до 06:30» — рахується від моменту, коли крок став поточним.
  const timing = c.left > 0 ? `Ще ${L.fmtDur(c.left)}, до ${L.fmtHM(c.end)}`
    : c.over > 0 ? `Довше запланованого на ${L.fmtDur(c.over)}` : 'Запланований час вийшов';
  return `<div class="vt-current">
    <p class="vt-now">Зараз, крок ${st.index} із ${st.count}</p>
    <p class="vt-title">${critTitle(c.title, c.critical)}</p>
    <p class="vt-meta">${nb(timing)}${c.critical ? '. Критичний крок' : ''}</p>
    ${items}${extra}
    <div class="vt-actions">
      <button type="button" class="btn btn-primary btn-lg" data-tone="amber" data-act="stepDone" data-id="${esc(c.id)}"${blocked ? ' disabled' : ''}>${icon('check')}Готово</button>
      ${c.critical ? '' : `<button type="button" class="btn btn-quiet btn-lg" data-act="stepSkip" data-id="${esc(c.id)}" aria-label="Пропустити крок">${icon('skip')}</button>`}
    </div>
    ${blocked ? '<p class="hint">Позначте всі пункти, щоб завершити крок.</p>' : ''}
  </div>`;
}

function timeline(app, sm, st) {
  const running = sm.phase === 'running' && st;
  const end = L.endLabel(sm.tpl);
  let rows;
  if (running || sm.phase === 'finished') {
    const live = st || L.sessionStatus(app.state, sm.session, Date.now());
    // Час ліворуч: для виконаного — коли позначено, для поточного — коли почався, для наступних — коли орієнтовно почнуться.
    const at = (ms) => (ms ? L.fmtHM(L.localMin(ms)) : '');
    rows = live.rows.map((r) => {
      const cur = live.current && r.id === live.current.id;
      const state = cur ? 'current' : r.state;
      const time = r.state === 'done' ? at(r.doneAt) : r.state === 'skipped' ? at(r.skipAt) : r.state === 'todo' ? L.fmtHM(r.start) : '';
      const meta = r.state === 'done' ? 'зроблено' : r.state === 'skipped' ? 'пропущено' : r.state === 'auto' ? 'пропускається: часу обмаль' : `${r.dur} хв`;
      const body = cur ? currentCard(app, live) : `<button type="button" class="vt-item" data-act="stepToggle" data-id="${esc(r.id)}" role="checkbox" aria-checked="${r.state === 'done'}"${r.state === 'auto' ? ' disabled' : ''}>
          <span class="vt-title">${critTitle(r.title, r.critical)}</span><span class="vt-meta">${meta}</span></button>`;
      return { state, time, body };
    });
  } else {
    rows = sm.plan.steps.map((s) => {
      const extra = s.critical ? ', не скорочується' : s.short === 0 ? ', можна пропустити' : s.short < s.min ? `, мінімум ${s.short} хв` : '';
      return {
        state: 'plan',
        time: L.fmtHM(s.start),
        body: `<button type="button" class="vt-item" data-act="openStep" data-id="${esc(s.id)}" aria-label="${esc(s.title)}, о ${L.fmtHM(s.start)}, ${s.dur} хвилин. Змінити">
          <span class="vt-title">${critTitle(s.title, s.critical)}</span><span class="vt-meta">${s.dur} хв${extra}${s.items.length ? `, пунктів: ${s.items.length}` : ''}</span></button>`,
      };
    });
  }
  const doneN = rows.filter((r) => r.state === 'done' || r.state === 'skipped').length;
  const past = rows.length ? Math.round((doneN / (rows.length + 1)) * 100) : 0;
  // Якщо не встигаєте — у шкалі орієнтовний час виходу, а план — у підписі. Шкала завжди йде за зростанням.
  const late = running && st && !st.finished && st.spare < 0;
  const endTime = late ? st.expected : sm.plan.departure;
  const endMeta = late ? `за планом о ${L.fmtHM(sm.plan.departure)}, на ${L.fmtDur(-st.spare)} пізніше` : L.homeDay(sm.tpl) ? 'початок справ' : `прибуття о ${sm.tpl.arrival}`;
  const endRow = `<div class="vt-row vt-end${late ? ' late' : ''}" data-state="${sm.phase === 'finished' ? 'done' : 'todo'}">
      <span class="vt-time">${L.fmtHM(endTime)}</span><span class="vt-node" aria-hidden="true"></span>
      <div class="vt-body"><div class="vt-item"><span class="vt-title">${esc(end)}</span><span class="vt-meta">${nb(endMeta)}</span></div></div></div>`;
  return `<div class="vt" style="--past:${past}%" role="list" aria-label="Кроки ранку">
    ${rows.map((r) => `<div class="vt-row" data-state="${r.state}" role="listitem">
      <span class="vt-time">${r.time}</span>
      <span class="vt-node" aria-hidden="true">${r.state === 'done' ? icon('check') : ''}</span>
      <div class="vt-body">${r.body}</div>
    </div>`).join('')}
    ${endRow}
  </div>`;
}

/* ---------- «Вихід без забутого» ---------- */

function essCard(app, sm, st) {
  const ess = app.state.morning.essentials;
  const need = !!st?.needEss;
  const ss = sm.session;
  const done = sm.phase === 'finished';
  let body;
  if (need) {
    body = `<div class="cl" role="group" aria-label="Речі перед виходом">${ess.map((e) => {
      const on = !!ss.ess?.[e.id];
      return `<button type="button" class="cl-item${on ? ' on' : ''}" role="checkbox" aria-checked="${on}" data-act="essTick" data-id="${esc(e.id)}"><span class="check${on ? ' on' : ''}" data-tone="amber" aria-hidden="true">${icon('check')}</span><span class="cl-main"><span class="cl-text">${esc(e.t)}</span></span></button>`;
    }).join('')}</div>
    <p class="hint">Кожну річ позначаєте ви — автоматично нічого не підтверджується. Ранок завершиться, коли позначено все.</p>`;
  } else if (ess.length) {
    body = `<ul class="ess-list">${ess.map((e) => `<li>${done && ss?.ess?.[e.id] ? icon('check') : ''}${esc(e.t)}</li>`).join('')}</ul>`;
  } else {
    body = '<p class="hint">Перелік порожній: ранок завершиться одразу після кроків.</p>';
  }
  return `<section class="ess-card${need ? ' is-active' : ''}" id="essCard" aria-labelledby="essH">
    <div class="sec-row"><h2 class="sec-h" id="essH">${icon('checkCircle', 'sec-ic')}Вихід без забутого</h2><button type="button" class="link" data-act="essEdit">Змінити</button></div>
    ${need ? '' : `<p class="sec-note">${done ? 'Перевірено перед виходом.' : 'Короткий перелік ваших речей — зʼявиться наприкінці ранку.'}</p>`}
    ${body}
  </section>`;
}

/* ---------- Сторінка ---------- */

function render(app) {
  const nowMs = Date.now();
  const sm = L.morningSummary(app.state, nowMs);
  const st = sm.phase === 'running' ? L.sessionStatus(app.state, sm.session, nowMs) : null;
  const p = sm.plan;
  const end = L.endLabel(sm.tpl);
  const when = sm.rel === 0 ? 'Сьогодні' : sm.rel === 1 ? 'Завтра' : L.shortDate(sm.date, app.today);
  const running = sm.phase === 'running' || sm.phase === 'finished';
  let action = '';
  if (sm.phase === 'running' && st) {
    action = `<div class="m-progress" role="progressbar" aria-label="Виконано кроків" aria-valuemin="0" aria-valuemax="${st.count}" aria-valuenow="${st.doneCount}"><span style="--f:${st.count ? (st.doneCount / st.count).toFixed(3) : 1}"></span></div>`;
  } else if (sm.phase === 'window' || (sm.phase === 'before' && sm.toWake <= 180)) {
    action = `<button type="button" class="btn btn-primary btn-xl btn-block" data-tone="amber" data-act="startSession">${icon('play')}Почати ранок</button>`;
  }
  return `<div class="page page-morning">
    ${photoHead({ title: 'Мій ранок', sub: `${when}, ${esc(L.dayMonth(sm.date)).replace(/^(\d+) /, '$1&nbsp;')}. ${esc(sm.tpl.name)}${running ? '' : `, ${nb(L.fmtDur(p.total))} на підготовку`}`, extra: bigBlock(app, sm, st, nowMs) })}
    ${tplChips(app, sm)}
    ${facts(sm)}
    ${action}
    ${st ? lateCard(st, end) : ''}
    <section class="section" aria-labelledby="stepsH">
      <div class="sec-row"><h2 class="sec-h" id="stepsH">${running ? 'Підготовка' : 'Кроки'}<span class="sec-count">${running && st ? `${st.doneCount} з ${st.count}` : L.fmtDur(p.total)}</span></h2></div>
      ${timeline(app, sm, st)}
      ${running ? '' : `<button type="button" class="row row-add vt-add" data-act="openStep" data-id="new">${icon('plus')}<span>Додати крок</span></button>`}
    </section>
    ${essCard(app, sm, st)}
    ${running ? `<div class="list" style="margin-top:22px">
        <label class="row field-row"><span class="row-main"><span class="row-title">Режим «Часу обмаль»</span><span class="row-meta">Мінімальний безпечний набір. Критичні кроки не скорочуються</span></span><input type="checkbox" class="switch" data-change="toggleShort"${sm.session.short ? ' checked' : ''}></label>
      </div>
      <button type="button" class="link small center" data-act="sessionReset">Почати підготовку заново</button>`
    : `<p class="foot">${esc(end)} = ${L.homeDay(sm.tpl) ? 'час початку справ − запас' : 'прибуття − дорога − запас'}. Підйом = ${esc(end.toLowerCase())} − тривалість кроків. ${icon('shield', 'crit')} — критичний крок: не скорочується й не пропускається.</p>
      <div class="row2"><button type="button" class="btn btn-quiet" data-act="tplDup">${icon('layers')}Копія шаблону</button>${sm.tpl.kind === 'custom'
        ? `<button type="button" class="btn btn-danger-plain" data-act="tplDelete" data-id="${esc(sm.tpl.id)}">${icon('trash')}Видалити</button>`
        : `<button type="button" class="btn btn-quiet" data-act="resetSteps">${icon('reset')}Типові кроки</button>`}</div>`}
  </div>`;
}

// Маршрут відкривається з картки «Підйом… Прибуття…» — окрема кнопка в панелі була б дублем.
function chrome() {
  return {};
}

// Ілюстрація — уся, за висотою сцени під панеллю навігації, праворуч: стовпчик кроків (ліжко → авто)
// видно повністю, текст — на спокійному лівому боці.
const backdrop = () => ({ src: 'morning-flow.webp', kind: 'stage', art: 'whole', pos: '50% 50%', h: '318px' });

/* ---------- Маршрут і шаблон ---------- */

function routeFoot(m) {
  const p = L.computePlan(m);
  return `${esc(L.endLabel(m))} о <b>${L.fmtHM(p.departure)}</b>, підйом о <b>${L.fmtHM(p.wake)}</b>. Запас — у хвилинах. Тривалість дороги запамʼятовується окремо для кожного виду транспорту.`;
}

function routeHtml(app) {
  const m = tplOf(app);
  const home = L.homeDay(m);
  return `${sheetHead(m.name)}
    ${m.kind === 'custom' ? `<div class="list"><label class="row field"><input class="input-plain" id="tplName" value="${esc(m.name)}" maxlength="40" placeholder="Назва шаблону" data-change="tplName" aria-label="Назва шаблону"></label></div>` : ''}
    <div class="list">
      <label class="row field-row"><span class="row-label" id="arrivalLabel">${home ? 'Початок справ' : 'Бажаний час прибуття'}</span><input id="arrivalInput" class="time-input" type="time" value="${esc(m.arrival)}" data-change="mArrival" required></label>
      <div class="row field-col"><span class="row-label">Дорога</span>${seg('Транспорт', L.TRANSPORT.map((t) => ({ id: t.id, name: t.id === 'none' ? 'Вдома' : t.name, icon: t.icon })), m.transport, 'mTransport')}</div>
      <div class="row field-row" id="travelRow"${home ? ' hidden' : ''}><span class="row-label">Тривалість дороги</span>
        <div class="stepper"><button type="button" class="st-btn" data-act="travelStep" data-d="-5" aria-label="Мінус 5 хвилин">−</button><input class="st-input" id="travelInput" type="number" inputmode="numeric" min="0" max="600" value="${m.travel[m.transport] ?? 0}" data-change="travelInput" aria-label="Тривалість дороги, хвилин"><span class="st-unit">хв</span><button type="button" class="st-btn" data-act="travelStep" data-d="5" aria-label="Плюс 5 хвилин">+</button></div></div>
      <div class="row field-col"><span class="row-label">Запас часу</span>${seg('Запас часу', L.BUFFERS.map((b) => ({ id: b, name: `${b}` })), m.buffer, 'mBuffer')}</div>
    </div>
    <p class="foot" id="routeFoot">${routeFoot(m)}</p>`;
}

function openRoute(app) {
  openSheet(routeHtml(app), { label: 'Маршрут' });
}
// Після зміни оновлюємо лише залежні частини панелі. Поля, з якими людина працює (вибір часу
// на iPhone, введення хвилин), не перебудовуються — інакше колесо вибору закривається після першої цифри.
function syncRoute(app) {
  const d = document.getElementById('sheet');
  if (!d.open || !d.querySelector('#routeFoot')) return;
  const m = tplOf(app);
  const home = L.homeDay(m);
  for (const b of d.querySelectorAll('[data-act="mTransport"]')) b.setAttribute('aria-checked', String(b.dataset.v === m.transport));
  for (const b of d.querySelectorAll('[data-act="mBuffer"]')) b.setAttribute('aria-checked', String(+b.dataset.v === m.buffer));
  d.querySelector('#travelRow').hidden = home;
  d.querySelector('#arrivalLabel').textContent = home ? 'Початок справ' : 'Бажаний час прибуття';
  const ti = d.querySelector('#travelInput');
  if (ti && document.activeElement !== ti) ti.value = m.travel[m.transport] ?? 0;
  const ai = d.querySelector('#arrivalInput');
  if (ai && document.activeElement !== ai && ai.value !== m.arrival) ai.value = m.arrival;
  d.querySelector('#routeFoot').innerHTML = routeFoot(m);
}
// Змінювати можна шаблон, що не використовується в поточній підготовці.
function editTpl(app, fn) {
  app.commit((s) => fn(L.currentTpl(s)));
  syncRoute(app);
}

/* ---------- Редактор кроку ---------- */

function openStep(app, el) {
  const isNew = el.dataset.id === 'new';
  const tpl = tplOf(app);
  const s = isNew
    ? { id: 'new', title: '', min: 5, short: 5, critical: false, items: [], kind: '' }
    : tpl.steps.find((x) => x.id === el.dataset.id);
  if (!s) return;
  openSheet(`
  <form class="sheet-form" data-submit="saveStep" data-id="${esc(s.id)}" data-critical="${s.critical}" autocomplete="off">
    ${sheetHead(isNew ? 'Новий крок' : 'Крок', { cancel: 'Скасувати', done: 'Готово', submit: true })}
    <div class="list"><label class="row field"><input class="input-plain" name="title" value="${esc(s.title)}" placeholder="Назва кроку" maxlength="80" enterkeyhint="done" aria-label="Назва кроку"${isNew ? ' data-focus' : ''}></label></div>
    <div class="list">
      <div class="row field-row"><span class="row-label">Тривалість</span>${stepper('min', s.min, 1, 180, 'Тривалість, хвилин')}</div>
      <label class="row field-row"><span class="row-main"><span class="row-title">Критичний крок</span><span class="row-meta">Не скорочується і не пропускається</span></span><input type="checkbox" class="switch" name="critical" data-change="stepCritical"${s.critical ? ' checked' : ''}></label>
      <div class="row field-row only-noncrit"><span class="row-main"><span class="row-title">Мінімум, коли часу обмаль</span><span class="row-meta">0 — крок можна пропустити</span></span>${stepper('short', s.short, 0, 180, 'Мінімальна тривалість, хвилин')}</div>
      <label class="row field-row"><span class="row-main"><span class="row-title">Показувати головні справи</span><span class="row-meta">Три пріоритети на сьогодні</span></span><input type="checkbox" class="switch" name="tasks"${s.kind === 'tasks' ? ' checked' : ''}></label>
      <label class="row field-row"><span class="row-main"><span class="row-title">Кнопка перевірки перед чергуванням</span><span class="row-meta">Відкриває перевірку в «Готовності»</span></span><input type="checkbox" class="switch" name="gear"${s.kind === 'gear' ? ' checked' : ''}></label>
    </div>
    <h3 class="sub-h">Пункти кроку</h3>
    <textarea class="textarea" name="items" rows="4" maxlength="800" placeholder="Кожен пункт — з нового рядка">${esc(s.items.join('\n'))}</textarea>
    <p class="hint">Крок із пунктами можна завершити лише тоді, коли позначено всі пункти.</p>
    ${isNew ? '' : `<div class="row2">
      <button type="button" class="btn btn-quiet" data-act="stepMove" data-id="${esc(s.id)}" data-d="-1">${icon('up')}Вище</button>
      <button type="button" class="btn btn-quiet" data-act="stepMove" data-id="${esc(s.id)}" data-d="1">${icon('down')}Нижче</button>
    </div>
    <div class="stack"><button type="button" class="btn btn-danger-plain btn-block" data-act="stepDelete" data-id="${esc(s.id)}">${icon('trash')}Видалити крок</button></div>`}
  </form>`, { label: 'Крок ранку' });
}

function saveStep(app, form) {
  const f = form.elements;
  const min = clamp(f.min.value, 1, 180, 5);
  const critical = f.critical.checked;
  const data = {
    title: f.title.value.trim().slice(0, 80) || 'Крок',
    min,
    critical,
    short: critical ? min : clamp(f.short.value, 0, min, min),
    items: f.items.value.split('\n').map((x) => x.trim().slice(0, 60)).filter(Boolean).slice(0, 12),
    kind: f.gear.checked ? 'gear' : f.tasks.checked ? 'tasks' : '',
  };
  app.commit((s) => {
    const tpl = L.currentTpl(s);
    if (form.dataset.id === 'new') tpl.steps.push({ id: L.uid(), ...data });
    else Object.assign(tpl.steps.find((x) => x.id === form.dataset.id) || {}, data);
  });
  closeSheet();
  toast('Збережено', null, 1600, 'check');
}

/* ---------- Підготовка ---------- */

export function startMorning(app) {
  if (!L.activeSession(app.state, L.localMin())) {
    app.commit((s) => { s.session = L.newSession(s, Date.now()); }, { render: false });
  }
}

function updateSession(app, fn) {
  if (!app.state.session) return;
  let finished = false;
  app.commit((s) => {
    fn(s.session);
    const st = L.sessionStatus(s, s.session, Date.now());
    finished = st.complete && !s.session.finishedAt;
    s.session.finishedAt = st.complete ? s.session.finishedAt || Date.now() : 0;
  });
  if (finished) { haptic(); toast('Ранкову підготовку завершено. Гарного дня!', null, 3200, 'check'); }
}

export function completeStep(app, id) {
  const ss = app.state.session;
  if (!ss) return;
  const step = L.tplById(app.state, ss.tpl).steps.find((x) => x.id === id);
  const checks = ss.checks[id] || [];
  if (step?.items.some((_, i) => !checks.includes(i))) { toast('Спершу позначте всі пункти кроку'); return; }
  updateSession(app, (x) => { x.done[id] = Date.now(); delete x.skipped[id]; });
  const st = app.state.session && L.sessionStatus(app.state, app.state.session, Date.now());
  if (st?.needEss && app.route.tab === 'morning') requestAnimationFrame(() => document.getElementById('essCard')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
}

// З головного екрана: відкрити ранок на переліку «Вихід без забутого».
export function openEssentials(app) {
  app.go('morning');
  requestAnimationFrame(() => document.getElementById('essCard')?.scrollIntoView({ block: 'center' }));
}

function openEssEditor(app) {
  const ess = app.state.morning.essentials;
  openSheet(`<form class="sheet-form" data-submit="essSave" autocomplete="off">
    ${sheetHead('Вихід без забутого', { cancel: 'Скасувати', done: 'Зберегти', submit: true })}
    <p class="sheet-text">Критично важливі особисті речі, які ви перевіряєте перед виходом. Кожна — з нового рядка, до 15.</p>
    <textarea class="textarea" name="items" rows="7" maxlength="900" placeholder="Документи&#10;Телефон&#10;Ключі" data-focus>${esc(ess.map((e) => e.t).join('\n'))}</textarea>
    <p class="hint">Пункти завжди позначаєте ви: застосунок нічого не підтверджує автоматично.</p>
  </form>`, { label: 'Вихід без забутого' });
}

function dupTemplate(app, name = '') {
  const customs = app.state.morning.templates.filter((t) => t.kind === 'custom').length;
  if (customs >= L.TPL_CUSTOM_MAX) { toast(`Власних шаблонів може бути до ${L.TPL_CUSTOM_MAX}`); return; }
  const src = L.currentTpl(app.state);
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = `tpl-c${L.uid().replace(/[^\w]/g, '').slice(0, 10)}`;
  copy.kind = 'custom';
  copy.name = (name || `${src.name}, копія`).slice(0, 40);
  copy.steps = copy.steps.map((s) => ({ ...s, id: L.uid() }));
  app.commit((s) => { s.morning.templates.push(copy); s.morning.active = copy.id; });
  openRoute(app);
  setTimeout(() => document.getElementById('tplName')?.focus(), 320);
}

const actions = {
  openStep,
  saveStep,
  openRoute,
  startSession(app) {
    startMorning(app);
    haptic();
    if (app.route.tab !== 'morning') app.go('morning'); else app.render();
  },
  stepDone(app, el) { haptic(); completeStep(app, el.dataset.id); },
  stepSkip(app, el) { updateSession(app, (ss) => { ss.skipped[el.dataset.id] = Date.now(); }); },
  stepToggle(app, el) {
    const id = el.dataset.id;
    const ss = app.state.session;
    if (!ss) return;
    if (ss.done[id] || ss.skipped[id]) { updateSession(app, (x) => { delete x.done[id]; delete x.skipped[id]; }); return; }
    completeStep(app, id);
  },
  subCheck(app, el) {
    const i = +el.dataset.i;
    updateSession(app, (ss) => {
      const list = new Set(ss.checks[el.dataset.id] || []);
      if (list.has(i)) list.delete(i); else list.add(i);
      ss.checks[el.dataset.id] = [...list];
    });
  },
  essTick(app, el) {
    const id = el.dataset.id;
    if (!app.state.session) return;
    const on = !app.state.session.ess?.[id];
    if (on) haptic();
    updateSession(app, (ss) => { ss.ess = ss.ess || {}; if (on) ss.ess[id] = Date.now(); else delete ss.ess[id]; });
  },
  essEdit: openEssEditor,
  essSave(app, form) {
    const lines = form.elements.items.value.split('\n').map((x) => x.trim().slice(0, 60)).filter(Boolean).slice(0, 15);
    app.commit((s) => {
      const old = s.morning.essentials;
      s.morning.essentials = lines.map((t) => old.find((e) => e.t === t) || { id: L.uid(), t });
    });
    closeSheet();
    toast('Перелік збережено', null, 1800, 'check');
  },
  mGearCheck(app, el) { startQueue(app, 'duty', el); },
  toggleShort(app, el) { updateSession(app, (ss) => { ss.short = el.checked; }); },
  shortOn(app) { haptic(); updateSession(app, (ss) => { ss.short = true; }); },
  async sessionReset(app) {
    const ok = await confirmSheet({ title: 'Почати підготовку заново?', text: 'Позначки кроків і речей буде скинуто.', ok: 'Почати заново' });
    if (!ok) return;
    app.commit((s) => { s.session = L.newSession(s, Date.now()); });
  },
  async tplPick(app, el) {
    const id = el.dataset.id;
    const sm = L.morningSummary(app.state, Date.now());
    if (id === sm.tpl.id) return;
    if (sm.phase === 'running' || sm.phase === 'finished') {
      const ok = await confirmSheet({ title: 'Змінити сценарій ранку?', text: 'Поточну підготовку буде завершено без збереження позначок.', ok: 'Змінити' });
      if (!ok) return;
      app.commit((s) => { s.session = null; s.morning.active = id; });
    } else app.commit((s) => { s.morning.active = id; });
    haptic();
    const t = L.currentTpl(app.state);
    const p = L.computePlan(t);
    toast(`${t.name}: підйом о ${L.fmtHM(p.wake)}, ${L.endLabel(t).toLowerCase()} о ${L.fmtHM(p.departure)}`, null, 2600);
  },
  tplNew(app) { dupTemplate(app, 'Мій ранок'); },
  // Третій аргумент дії — подія натискання, тому назву копії передаємо лише через dupTemplate.
  tplDup(app) { dupTemplate(app); },
  async tplDelete(app, el) {
    const t = app.state.morning.templates.find((x) => x.id === el.dataset.id);
    if (!t || t.kind !== 'custom') return;
    const ok = await confirmSheet({ title: `Видалити шаблон «${t.name}»?`, ok: 'Видалити', danger: true });
    if (!ok) return;
    app.commit((s) => {
      s.morning.templates = s.morning.templates.filter((x) => x.id !== t.id);
      if (s.morning.active === t.id) s.morning.active = 'tpl-work';
      if (s.session?.tpl === t.id) s.session = null;
    });
    toast('Шаблон видалено');
  },
  tplName(app, el) {
    const name = el.value.trim().slice(0, 40);
    if (!name) return;
    app.commit((s) => { const t = L.currentTpl(s); if (t.kind === 'custom') t.name = name; });
    const head = document.querySelector('#sheet .sheet-title');
    if (head) head.textContent = name;
    toast('Назву збережено', null, 1500, 'check');
  },
  mArrival(app, el) {
    const v = L.parseHM(el.value);
    if (v == null) return;
    editTpl(app, (t) => { t.arrival = L.fmtHM(v); });
  },
  mTransport(app, el) { editTpl(app, (t) => { t.transport = el.dataset.v; }); },
  mBuffer(app, el) { editTpl(app, (t) => { t.buffer = +el.dataset.v; }); },
  travelStep(app, el) {
    editTpl(app, (t) => { t.travel[t.transport] = clamp((t.travel[t.transport] || 0) + +el.dataset.d, 0, 600, 0); });
  },
  travelInput(app, el) { editTpl(app, (t) => { t.travel[t.transport] = clamp(el.value, 0, 600, 0); }); },
  numStep(app, el) {
    const input = el.parentElement.querySelector('input');
    input.value = clamp(+input.value + +el.dataset.d, +input.min, +input.max, +input.min);
  },
  stepCritical(app, el) { el.closest('form').dataset.critical = String(el.checked); },
  stepMove(app, el) {
    app.commit((s) => { const t = L.currentTpl(s); t.steps = L.moveItem(t.steps, el.dataset.id, +el.dataset.d); });
    toast(+el.dataset.d < 0 ? 'Крок переміщено вище' : 'Крок переміщено нижче');
  },
  stepDelete(app, el) {
    const steps = tplOf(app).steps;
    const i = steps.findIndex((x) => x.id === el.dataset.id);
    if (i < 0) return;
    const removed = steps[i];
    app.commit((s) => { L.currentTpl(s).steps.splice(i, 1); });
    closeSheet();
    toast('Крок видалено', { label: 'Скасувати', run: () => app.commit((s) => { L.currentTpl(s).steps.splice(i, 0, removed); }) });
  },
  async resetSteps(app) {
    const t = tplOf(app);
    const ok = await confirmSheet({ title: 'Відновити типові кроки?', text: `Кроки шаблону «${t.name}» буде замінено типовими. Час прибуття й маршрут не зміняться.`, ok: 'Відновити' });
    if (!ok) return;
    app.commit((s) => { const x = L.currentTpl(s); x.steps = L.defaultSteps(x.kind); });
  },
};

export default { title: 'Мій ранок', render, chrome, backdrop, actions };
