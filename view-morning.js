// ОПОРА 365 — «Ранок»: Morning Flow. Час виходу великими цифрами, вертикальна шкала кроків,
// поточний крок підсвічено, при запізненні — янтарний акцент і короткий сценарій без тиску.
import * as L from './logic.js';
import { esc, icon, seg, openSheet, closeSheet, confirmSheet, toast, sheetHead, stepper, haptic } from './ui.js';

const TR = Object.fromEntries(L.TRANSPORT.map((t) => [t.id, t]));
const TR_ICON = { bus: 'bus', car: 'car', taxi: 'taxi', walk: 'walk' };
const clamp = (v, lo, hi, d) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

function levelInfo(st) {
  if (st.level === 'ok') return { level: 'ok', ic: 'checkCircle', text: `У графіку · запас ${L.fmtDur(st.spare)}` };
  if (st.level === 'tight') return { level: 'tight', ic: 'clock', text: `Часу обмаль: бракує ${L.fmtDur(-st.spare)}` };
  return { level: 'late', ic: 'clock', text: `Вихід орієнтовно о ${L.fmtHM(st.expected)} · пізніше на ${L.fmtDur(-st.spare)}` };
}

function bigLeft(min) {
  if (min <= 0) return 'час виходу настав';
  return `через ${L.fmtDur(min)}`;
}

/* ---------- Верхня картка: «ВИХІД 07:35» ---------- */

function heroBlock(app, sm, st) {
  const m = app.state.morning;
  const p = sm.plan;
  const tomorrow = sm.rel === 1;
  let level = 'normal', left = '', pill = '', btn = '', progress = '';
  if (sm.phase === 'running' && st) {
    const info = levelInfo(st);
    level = st.level === 'ok' ? 'normal' : st.level;
    left = st.toDep >= 0 ? `залишилось ${L.fmtDur(st.toDep)}` : `вихід мав бути ${L.fmtDur(-st.toDep)} тому`;
    pill = `<p class="pill" data-level="${info.level}">${icon(info.ic)}${esc(info.text)}</p>`;
    progress = `<div class="m-progress" role="progressbar" aria-label="Виконано кроків" aria-valuemin="0" aria-valuemax="${st.count}" aria-valuenow="${st.doneCount}"><span style="--f:${st.count ? (st.doneCount / st.count).toFixed(3) : 1}"></span></div>`;
  } else if (sm.phase === 'finished') {
    const diff = Math.round(sm.depAt - L.localMin(sm.session.finishedAt));
    left = diff >= 0 ? `готові · запас ${L.fmtDur(diff)}` : 'готові до виходу';
    pill = `<p class="pill" data-level="ok">${icon('checkCircle')}Підготовку завершено о ${L.fmtHM(L.localMin(sm.session.finishedAt))}</p>`;
  } else if (sm.phase === 'window') {
    level = 'tight';
    left = `${bigLeft(sm.toDep)} · час збиратися`;
    btn = `<button type="button" class="btn btn-primary btn-xl btn-block" data-tone="amber" data-act="startSession">${icon('play')}Почати ранок</button>`;
  } else if (sm.phase === 'after') {
    left = `вихід був о ${L.fmtHM(p.departure)}`;
  } else {
    left = `підйом ${L.relIn(sm.toWake)}`;
    // Кнопку старту показуємо лише за 3 години до підйому — раніше вона нічого не дає.
    if (sm.toWake <= 180) btn = `<button type="button" class="btn btn-primary btn-xl btn-block" data-tone="amber" data-act="startSession">${icon('play')}Почати ранок</button>`;
  }
  return `<section class="m-hero" data-level="${level}" aria-label="Час виходу">
    <span class="eyebrow">${icon('sunrise')}Вихід${tomorrow ? ' · завтра' : ''}</span>
    <p class="m-big">${L.fmtHM(p.departure)}</p>
    <p class="m-left">${esc(left)}</p>
    ${pill}
    <ul class="m-facts">
      <li>${icon('sunrise')}Підйом <b>${L.fmtHM(p.wake)}</b>${p.wakePrevDay ? ' (напередодні)' : ''}</li>
      <li>${icon(TR_ICON[m.transport])}${esc(TR[m.transport].name)} <b>${p.travel} хв</b></li>
      <li>${icon('clock')}Запас <b>${p.buffer} хв</b></li>
      <li>${icon('flag')}Прибуття <b>${esc(m.arrival)}</b></li>
    </ul>
    ${progress}
    ${btn}
  </section>`;
}

// Короткий сценарій: що зміниться в режимі «Часу обмаль» (реальні тривалості кроків).
function lateCard(app, st) {
  if (st.finished || st.level === 'ok') return '';
  if (!st.short) {
    const rows = st.rows.filter((r) => r.state === 'todo' && !r.critical && r.short < r.min);
    if (!rows.length) return '';
    const can = st.level === 'tight';
    return `<section class="late-card" aria-label="Короткий сценарій">
      <h3>${icon('clock')}Короткий сценарій</h3>
      <p>${can ? `Мінімальний набір кроків вкладається в час: запас ${L.fmtDur(st.altSpare)}.` : 'Навіть мінімальний набір не встигає, але скоротить запізнення.'} Критичні перевірки не скорочуються.</p>
      <ul>${rows.map((r) => `<li><span>${esc(r.title)}</span><span>${r.short === 0 ? 'пропустити' : `${r.min} → ${r.short} хв`}</span></li>`).join('')}</ul>
      <button type="button" class="btn btn-primary btn-block" data-tone="amber" data-act="shortOn">Увімкнути «Часу обмаль»</button>
    </section>`;
  }
  return `<section class="late-card" aria-label="Запізнення">
    <h3>${icon('clock')}Орієнтовний вихід о ${L.fmtHM(st.expected)}</h3>
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
  let tasks = '';
  if (c.kind === 'tasks') {
    const focus = L.taskView(app.state.tasks, app.today, app.state.pin).focus;
    tasks = `<div class="now-tasks">${focus.length ? focus.map((t) => `<p><span class="dot" data-tone="${L.PR[t.pr].tone}"></span>${esc(t.title)}</p>`).join('') : '<p class="muted">На сьогодні справ немає.</p>'}</div>`;
  }
  return `<div class="vt-current">
    <span class="eyebrow">Зараз · крок ${st.index} із ${st.count}</span>
    <p class="vt-title">${esc(c.title)}${c.critical ? icon('shield', 'crit') : ''}</p>
    <p class="vt-meta">${L.fmtDur(c.left)} · орієнтовно до ${L.fmtHM(c.eta + c.left)}${c.critical ? ' · критична перевірка' : ''}</p>
    ${items}${tasks}
    <div class="vt-actions">
      <button type="button" class="btn btn-primary btn-lg" data-tone="amber" data-act="stepDone" data-id="${esc(c.id)}"${blocked ? ' disabled' : ''}>${icon('check')}Готово</button>
      ${c.critical ? '' : `<button type="button" class="btn btn-quiet btn-lg" data-act="stepSkip" data-id="${esc(c.id)}" aria-label="Пропустити крок">${icon('skip')}</button>`}
    </div>
    ${blocked ? '<p class="hint">Позначте всі пункти перевірки, щоб завершити крок.</p>' : ''}
  </div>`;
}

function timeline(app, sm, st) {
  const running = sm.phase === 'running' && st;
  let rows;
  if (running || sm.phase === 'finished') {
    const live = st || L.sessionStatus(app.state, sm.session, Date.now());
    rows = live.rows.map((r) => {
      const cur = live.current && r.id === live.current.id;
      const state = cur ? 'current' : r.state;
      const time = r.state === 'done' ? L.fmtHM(L.localMin(r.doneAt)) : r.state === 'todo' ? L.fmtHM(r.eta) : L.fmtHM(r.start);
      const meta = r.state === 'done' ? 'зроблено' : r.state === 'skipped' ? 'пропущено' : r.state === 'auto' ? 'пропускається — часу обмаль' : `${r.dur} хв`;
      const body = cur ? currentCard(app, live) : `<button type="button" class="vt-item" data-act="stepToggle" data-id="${esc(r.id)}" role="checkbox" aria-checked="${r.state === 'done'}"${r.state === 'auto' ? ' disabled' : ''}>
          <span class="vt-title">${esc(r.title)}${r.critical ? icon('shield', 'crit') : ''}</span><span class="vt-meta">${meta}</span></button>`;
      return { state, time, body };
    });
  } else {
    rows = sm.plan.steps.map((s) => {
      const extra = s.critical ? ' · не скорочується' : s.short === 0 ? ' · можна пропустити' : s.short < s.min ? ` · мінімум ${s.short} хв` : '';
      return {
        state: 'plan',
        time: L.fmtHM(s.start),
        body: `<button type="button" class="vt-item" data-act="openStep" data-id="${esc(s.id)}" aria-label="${esc(s.title)}, о ${L.fmtHM(s.start)}, ${s.dur} хвилин. Змінити">
          <span class="vt-title">${esc(s.title)}${s.critical ? icon('shield', 'crit') : ''}</span><span class="vt-meta">${s.dur} хв${extra}${s.items.length ? ` · пунктів: ${s.items.length}` : ''}</span></button>`,
      };
    });
  }
  const doneN = rows.filter((r) => r.state === 'done' || r.state === 'skipped').length;
  const past = rows.length ? Math.round((doneN / (rows.length + 1)) * 100) : 0;
  const late = running && st && !st.finished && st.spare < 0;
  const endMeta = late ? `за планом · орієнтовно о ${L.fmtHM(st.expected)}` : `прибуття о ${esc(app.state.morning.arrival)}`;
  const end = `<div class="vt-row vt-end${late ? ' late' : ''}" data-state="${sm.phase === 'finished' ? 'done' : 'todo'}">
      <span class="vt-time">${L.fmtHM(sm.plan.departure)}</span><span class="vt-node" aria-hidden="true"></span>
      <div class="vt-body"><div class="vt-item"><span class="vt-title">ВИХІД</span><span class="vt-meta">${endMeta}</span></div></div></div>`;
  return `<div class="vt" style="--past:${past}%" role="list" aria-label="Кроки ранку">
    ${rows.map((r) => `<div class="vt-row" data-state="${r.state}" role="listitem">
      <span class="vt-time">${r.time}</span>
      <span class="vt-node" aria-hidden="true">${r.state === 'done' ? icon('check') : ''}</span>
      <div class="vt-body">${r.body}</div>
    </div>`).join('')}
    ${end}
  </div>`;
}

function finishedCard(sm) {
  const diff = Math.round(sm.depAt - L.localMin(sm.session.finishedAt));
  return `<section class="card finished-card">
    <span class="big-check">${icon('check')}</span>
    <h2 class="sec-h" style="justify-content:center">Готові до виходу</h2>
    <p class="muted">${diff >= 0 ? `Запас ${L.fmtDur(diff)} до виходу о ${L.fmtHM(sm.plan.departure)}` : `Пізніше запланованого на ${L.fmtDur(-diff)}`}</p>
    <button type="button" class="btn btn-tinted btn-block" style="margin-top:14px" data-act="tab" data-tab="home">${icon('orb')}До головної</button>
  </section>`;
}

function render(app) {
  const nowMs = Date.now();
  const sm = L.morningSummary(app.state, nowMs);
  const st = sm.phase === 'running' ? L.sessionStatus(app.state, sm.session, nowMs) : null;
  const p = sm.plan;
  const when = sm.rel === 0 ? 'Сьогодні' : sm.rel === 1 ? 'Завтра' : L.shortDate(sm.date, app.today);
  const running = sm.phase === 'running' || sm.phase === 'finished';
  return `<div class="page">
    <h1 class="large-title" data-title-anchor>Ранок</h1>
    <p class="page-sub">${when}, ${L.dayMonth(sm.date)} · ${L.fmtDur(p.total)} на підготовку</p>
    ${heroBlock(app, sm, st)}
    ${st ? lateCard(app, st) : ''}
    ${sm.phase === 'finished' ? finishedCard(sm) : ''}
    <section class="section" aria-labelledby="stepsH">
      <div class="sec-row"><h2 class="sec-h" id="stepsH">${running ? 'Підготовка' : 'Кроки'}<span class="sec-count">${running && st ? `${st.doneCount} з ${st.count}` : L.fmtDur(p.total)}</span></h2>
        ${running ? '' : '<button type="button" class="link" data-act="openRoute">Маршрут</button>'}</div>
      ${timeline(app, sm, st)}
      ${running ? '' : `<button type="button" class="row row-add vt-add" data-act="openStep" data-id="new">${icon('plus')}<span>Додати крок</span></button>`}
    </section>
    ${running ? `<div class="list" style="margin-top:18px">
        <label class="row field-row"><span class="row-main"><span class="row-title">Режим «Часу обмаль»</span><span class="row-meta">Мінімальний безпечний набір. Критичні перевірки не скорочуються.</span></span><input type="checkbox" class="switch" data-change="toggleShort"${sm.session.short ? ' checked' : ''}></label>
      </div>
      <button type="button" class="link small center" data-act="sessionReset">Почати підготовку заново</button>`
    : `<p class="foot">Вихід = прибуття − дорога − запас. Підйом = вихід − тривалість кроків. ${icon('shield', 'crit')} — критична перевірка: не скорочується й не пропускається.</p>
      <button type="button" class="link small center" data-act="resetSteps">Відновити типові кроки</button>`}
  </div>`;
}

function chrome() {
  return { right: `<button type="button" class="icon-btn" data-act="openRoute" aria-label="Маршрут і час прибуття">${icon('sliders')}</button>` };
}

/* ---------- Маршрут ---------- */

function routeHtml(app) {
  const m = app.state.morning;
  const p = L.computePlan(m);
  const trOptions = L.TRANSPORT.map((t) => ({ id: t.id, name: t.name, icon: TR_ICON[t.id] }));
  return `${sheetHead('Маршрут')}
    <div class="list">
      <label class="row field-row"><span class="row-label">Бажаний час прибуття</span><input id="arrivalInput" class="time-input" type="time" value="${esc(m.arrival)}" data-change="mArrival" required></label>
      <div class="row field-col"><span class="row-label">Транспорт</span>${seg('Транспорт', trOptions, m.transport, 'mTransport')}</div>
      <div class="row field-row"><span class="row-label">Дорога · ${esc(TR[m.transport].name.toLowerCase())}</span>
        <div class="stepper"><button type="button" class="st-btn" data-act="travelStep" data-d="-5" aria-label="Мінус 5 хвилин">−</button><input class="st-input" id="travelInput" type="number" inputmode="numeric" min="0" max="600" value="${p.travel}" data-change="travelInput" aria-label="Тривалість дороги, хвилин"><span class="st-unit">хв</span><button type="button" class="st-btn" data-act="travelStep" data-d="5" aria-label="Плюс 5 хвилин">+</button></div></div>
      <div class="row field-col"><span class="row-label">Запас часу</span>${seg('Запас часу', L.BUFFERS.map((b) => ({ id: b, name: `${b} хв` })), m.buffer, 'mBuffer')}</div>
    </div>
    <p class="foot">Вихід о <b>${L.fmtHM(p.departure)}</b>, підйом о <b>${L.fmtHM(p.wake)}</b>. Тривалість дороги запамʼятовується окремо для кожного виду транспорту.</p>`;
}

function openRoute(app) {
  openSheet(routeHtml(app), { label: 'Маршрут' });
}
function refreshRoute(app) {
  const d = document.getElementById('sheet');
  if (!d.open) return;
  const body = d.querySelector('.sheet-body');
  const top = body.scrollTop;
  body.innerHTML = routeHtml(app);
  body.scrollTop = top;
}

/* ---------- Редактор кроку ---------- */

function openStep(app, el) {
  const isNew = el.dataset.id === 'new';
  const s = isNew
    ? { id: 'new', title: '', min: 5, short: 5, critical: false, items: [], kind: '' }
    : app.state.morning.steps.find((x) => x.id === el.dataset.id);
  if (!s) return;
  openSheet(`
  <form class="sheet-form" data-submit="saveStep" data-id="${esc(s.id)}" data-critical="${s.critical}" autocomplete="off">
    ${sheetHead(isNew ? 'Новий крок' : 'Крок', { cancel: 'Скасувати', done: 'Готово', submit: true })}
    <div class="list"><label class="row field"><input class="input-plain" name="title" value="${esc(s.title)}" placeholder="Назва кроку" maxlength="80" enterkeyhint="done" aria-label="Назва кроку"${isNew ? ' data-focus' : ''}></label></div>
    <div class="list">
      <div class="row field-row"><span class="row-label">Тривалість</span>${stepper('min', s.min, 1, 180, 'Тривалість, хвилин')}</div>
      <label class="row field-row"><span class="row-main"><span class="row-title">Критична перевірка</span><span class="row-meta">Не скорочується і не пропускається</span></span><input type="checkbox" class="switch" name="critical" data-change="stepCritical"${s.critical ? ' checked' : ''}></label>
      <div class="row field-row only-noncrit"><span class="row-main"><span class="row-title">Мінімум, коли часу обмаль</span><span class="row-meta">0 — крок можна пропустити</span></span>${stepper('short', s.short, 0, 180, 'Мінімальна тривалість, хвилин')}</div>
      <label class="row field-row"><span class="row-main"><span class="row-title">Показувати головні справи</span><span class="row-meta">Три пріоритети на сьогодні</span></span><input type="checkbox" class="switch" name="tasks"${s.kind === 'tasks' ? ' checked' : ''}></label>
    </div>
    <h3 class="sub-h">Пункти перевірки</h3>
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
    kind: f.tasks.checked ? 'tasks' : '',
  };
  app.commit((s) => {
    if (form.dataset.id === 'new') s.morning.steps.push({ id: L.uid(), ...data });
    else Object.assign(s.morning.steps.find((x) => x.id === form.dataset.id) || {}, data);
  });
  closeSheet();
}

/* ---------- Підготовка ---------- */

export function startMorning(app) {
  if (!L.activeSession(app.state, L.localMin())) {
    app.commit((s) => { s.session = L.newSession(s.morning, Date.now()); }, { render: false });
  }
}

function updateSession(app, fn) {
  if (!app.state.session) return;
  let finished = false;
  app.commit((s) => {
    fn(s.session);
    const st = L.sessionStatus(s, s.session, Date.now());
    finished = st.finished && !s.session.finishedAt;
    s.session.finishedAt = st.finished ? s.session.finishedAt || Date.now() : 0;
  });
  if (finished) { haptic(); toast('Ранкову підготовку завершено. Гарного дня!'); }
}

export function completeStep(app, id) {
  const ss = app.state.session;
  if (!ss) return;
  const step = app.state.morning.steps.find((x) => x.id === id);
  const checks = ss.checks[id] || [];
  if (step?.items.some((_, i) => !checks.includes(i))) { toast('Спершу позначте всі пункти перевірки'); return; }
  updateSession(app, (x) => { x.done[id] = Date.now(); delete x.skipped[id]; });
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
  stepSkip(app, el) { updateSession(app, (ss) => { ss.skipped[el.dataset.id] = true; }); },
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
  toggleShort(app, el) { updateSession(app, (ss) => { ss.short = el.checked; }); },
  shortOn(app) { haptic(); updateSession(app, (ss) => { ss.short = true; }); },
  async sessionReset(app) {
    const ok = await confirmSheet({ title: 'Почати підготовку заново?', text: 'Позначки кроків буде скинуто.', ok: 'Почати заново' });
    if (!ok) return;
    app.commit((s) => { s.session = L.newSession(s.morning, Date.now()); });
  },
  mArrival(app, el) {
    const v = L.parseHM(el.value);
    if (v == null) return;
    app.commit((s) => { s.morning.arrival = L.fmtHM(v); });
    refreshRoute(app);
  },
  mTransport(app, el) { app.commit((s) => { s.morning.transport = el.dataset.v; }); refreshRoute(app); },
  mBuffer(app, el) { app.commit((s) => { s.morning.buffer = +el.dataset.v; }); refreshRoute(app); },
  travelStep(app, el) {
    app.commit((s) => {
      const m = s.morning;
      m.travel[m.transport] = clamp((m.travel[m.transport] || 0) + +el.dataset.d, 0, 600, 0);
    });
    refreshRoute(app);
  },
  travelInput(app, el) {
    app.commit((s) => { s.morning.travel[s.morning.transport] = clamp(el.value, 0, 600, 0); });
    refreshRoute(app);
  },
  numStep(app, el) {
    const input = el.parentElement.querySelector('input');
    input.value = clamp(+input.value + +el.dataset.d, +input.min, +input.max, +input.min);
  },
  stepCritical(app, el) { el.closest('form').dataset.critical = String(el.checked); },
  stepMove(app, el) {
    app.commit((s) => { s.morning.steps = L.moveItem(s.morning.steps, el.dataset.id, +el.dataset.d); });
    toast(+el.dataset.d < 0 ? 'Крок переміщено вище' : 'Крок переміщено нижче');
  },
  stepDelete(app, el) {
    const steps = app.state.morning.steps;
    const i = steps.findIndex((x) => x.id === el.dataset.id);
    if (i < 0) return;
    const removed = steps[i];
    app.commit((s) => { s.morning.steps.splice(i, 1); });
    closeSheet();
    toast('Крок видалено', { label: 'Скасувати', run: () => app.commit((s) => { s.morning.steps.splice(i, 0, removed); }) });
  },
  async resetSteps(app) {
    const ok = await confirmSheet({ title: 'Відновити типові кроки?', text: 'Ваші кроки буде замінено на сім стандартних. Час прибуття і маршрут не зміняться.', ok: 'Відновити' });
    if (!ok) return;
    app.commit((s) => { s.morning.steps = L.defaultSteps(); });
  },
};

export default { title: 'Ранок', render, chrome, actions };
