// ОПОРА — «Ранок»: план із часом виходу, кроки і режим ранкової підготовки.
import * as L from './logic.js';
import { $, esc, icon, seg, openSheet, closeSheet, confirmSheet, toast } from './ui.js';

const TR = Object.fromEntries(L.TRANSPORT.map((t) => [t.id, t]));
const TR_ICON = { bus: 'bus', car: 'car', taxi: 'taxi', walk: 'walk' };
const clamp = (v, lo, hi, d) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

function levelInfo(st) {
  if (st.level === 'ok') return { level: 'ok', text: `У графіку · запас ${L.fmtDur(st.spare)}` };
  if (st.level === 'tight') return { level: 'tight', text: `Часу обмаль: бракує ${L.fmtDur(-st.spare)}` };
  return { level: 'late', text: `Вихід орієнтовно о ${L.fmtHM(st.expected)} · пізніше на ${L.fmtDur(-st.spare)}` };
}

/* ---------- Картка ранку (екрани «Сьогодні» і «Ранок») ---------- */

export function morningCard(app, { link = false } = {}) {
  const now = Date.now();
  const sm = L.morningSummary(app.state, now);
  const m = app.state.morning;
  const p = sm.plan;
  const label = sm.rel === 0 ? 'Сьогодні' : sm.rel === 1 ? 'Завтра' : L.shortDate(sm.date, app.today);
  let status = '', level = '', btn = 'Почати ранкову підготовку', primary = true;
  if (sm.phase === 'before') {
    if (sm.toWake <= 16 * 60) status = `Підйом через ${L.fmtDur(sm.toWake)}`;
  } else if (sm.phase === 'window') {
    status = `Час збиратися · до виходу ${L.fmtDur(sm.toDep)}`;
    level = 'tight';
  } else if (sm.phase === 'running') {
    const st = L.sessionStatus(app.state, sm.session, now);
    ({ text: status, level } = levelInfo(st));
    btn = `Продовжити · ${st.doneCount} з ${st.count}`;
  } else if (sm.phase === 'finished') {
    status = `Готові до виходу · завершено о ${L.fmtHM(L.localMin(sm.session.finishedAt))}`;
    level = 'ok';
    btn = 'Відкрити підготовку';
    primary = false;
  } else {
    status = `Час виходу минув о ${L.fmtHM(p.departure)}`;
    primary = false;
  }
  return `<section class="mcard" aria-label="Ранковий план">
    <div class="mcard-top">
      <span class="mcard-label">${icon('sunrise')}${label}</span>
      ${link ? '<button type="button" class="link" data-act="tab" data-tab="morning">Налаштувати</button>' : ''}
    </div>
    <div class="mtimes">
      <div class="mtime"><span class="mtime-k">Підйом</span><span class="mtime-v">${L.fmtHM(p.wake)}</span>${p.wakePrevDay ? '<span class="mtime-n">напередодні</span>' : ''}</div>
      <div class="mtime main"><span class="mtime-k">Вихід</span><span class="mtime-v">${L.fmtHM(p.departure)}</span></div>
    </div>
    <p class="mcard-sub">Прибуття ${esc(m.arrival)} · ${TR[m.transport].name.toLowerCase()} ${p.travel} хв · запас ${p.buffer} хв</p>
    ${status ? `<p class="mstatus" data-level="${level}">${status}</p>` : ''}
    <button type="button" class="btn ${primary ? 'btn-primary' : 'btn-tinted'} btn-block btn-lg" data-act="startSession">${btn}</button>
  </section>`;
}

/* ---------- Екран «Ранок» ---------- */

function travelStepper(value) {
  return `<div class="stepper">
    <button type="button" class="st-btn" data-act="travelStep" data-d="-5" aria-label="Мінус 5 хвилин">−</button>
    <input class="st-input" id="travelInput" type="number" inputmode="numeric" min="0" max="600" value="${value}" data-change="travelInput" aria-label="Тривалість дороги, хвилин">
    <span class="st-unit">хв</span>
    <button type="button" class="st-btn" data-act="travelStep" data-d="5" aria-label="Плюс 5 хвилин">+</button>
  </div>`;
}

function render(app) {
  const m = app.state.morning;
  const p = L.computePlan(m);
  const trOptions = L.TRANSPORT.map((t) => ({ id: t.id, name: t.name, icon: TR_ICON[t.id] }));
  const steps = p.steps.map((s) => {
    const extra = s.critical ? ' · не скорочується' : s.short === 0 ? ' · можна пропустити' : s.short < s.min ? ` · мінімум ${s.short} хв` : '';
    const items = s.items.length ? ` · пунктів: ${s.items.length}` : '';
    return `<button type="button" class="row tl-row" data-act="openStep" data-id="${esc(s.id)}">
      <span class="tl-time">${L.fmtHM(s.start)}</span>
      <span class="row-main"><span class="row-title">${esc(s.title)}${s.critical ? icon('shield', 'crit') : ''}</span><span class="row-meta">${s.dur} хв${extra}${items}</span></span>
      ${icon('chev', 'row-chev')}
    </button>`;
  }).join('');
  return `<div class="page">
    <p class="eyebrow">Ранковий план</p>
    <h1 class="large-title">Ранок</h1>
    ${morningCard(app)}
    <section class="section">
      <h2 class="sec-h">Маршрут</h2>
      <div class="list">
        <label class="row field-row"><span class="row-label">Бажаний час прибуття</span><input id="arrivalInput" class="time-input" type="time" value="${esc(m.arrival)}" data-change="mArrival" required></label>
        <div class="row field-col"><span class="row-label">Транспорт</span>${seg('Транспорт', trOptions, m.transport, 'mTransport')}</div>
        <div class="row field-row"><span class="row-label">Дорога · ${TR[m.transport].name.toLowerCase()}</span>${travelStepper(p.travel)}</div>
        <div class="row field-col"><span class="row-label">Запас часу</span>${seg('Запас часу', L.BUFFERS.map((b) => ({ id: b, name: `${b} хв` })), m.buffer, 'mBuffer')}</div>
      </div>
      <p class="foot">Вихід = прибуття − дорога − запас. Тривалість дороги запамʼятовується окремо для кожного виду транспорту.</p>
    </section>
    <section class="section">
      <h2 class="sec-h">Кроки<span class="sec-count">${L.fmtDur(p.total)}</span></h2>
      <div class="list">
        ${steps}
        <button type="button" class="row row-add" data-act="openStep" data-id="new">${icon('plus')}<span>Додати крок</span></button>
      </div>
      <p class="foot">Підйом = вихід − тривалість усіх кроків. У режимі «Часу обмаль» звичайні кроки скорочуються до мінімуму, а критичні перевірки ${icon('shield', 'crit')} — ніколи.</p>
      <button type="button" class="link small center" data-act="resetSteps">Відновити типові кроки</button>
    </section>
  </div>`;
}

/* ---------- Редактор кроку ---------- */

function numStepper(name, value, lo, hi, label) {
  return `<div class="stepper">
    <button type="button" class="st-btn" data-act="numStep" data-d="-1" aria-label="Менше">−</button>
    <input class="st-input" type="number" inputmode="numeric" name="${name}" value="${value}" min="${lo}" max="${hi}" aria-label="${esc(label)}">
    <span class="st-unit">хв</span>
    <button type="button" class="st-btn" data-act="numStep" data-d="1" aria-label="Більше">+</button>
  </div>`;
}

function openStep(app, el) {
  const isNew = el.dataset.id === 'new';
  const s = isNew
    ? { id: 'new', title: '', min: 5, short: 5, critical: false, items: [], kind: '' }
    : app.state.morning.steps.find((x) => x.id === el.dataset.id);
  if (!s) return;
  openSheet(`
  <form class="sheet-form" data-submit="saveStep" data-id="${esc(s.id)}" data-critical="${s.critical}" autocomplete="off">
    <div class="sheet-head">
      <button type="button" class="link" data-act="sheetClose">Скасувати</button>
      <h2 class="sheet-title">${isNew ? 'Новий крок' : 'Крок'}</h2>
      <button type="submit" class="link strong">Готово</button>
    </div>
    <div class="list"><label class="row field"><input class="input-plain" name="title" value="${esc(s.title)}" placeholder="Назва кроку" maxlength="80" enterkeyhint="done" aria-label="Назва кроку"${isNew ? ' data-focus' : ''}></label></div>
    <div class="list">
      <div class="row field-row"><span class="row-label">Тривалість</span>${numStepper('min', s.min, 1, 180, 'Тривалість, хвилин')}</div>
      <label class="row field-row"><span class="row-main"><span class="row-title">Критична перевірка</span><span class="row-meta">Не скорочується і не пропускається</span></span><input type="checkbox" class="switch" name="critical" data-change="stepCritical"${s.critical ? ' checked' : ''}></label>
      <div class="row field-row only-noncrit"><span class="row-main"><span class="row-title">Мінімум, коли часу обмаль</span><span class="row-meta">0 — крок можна пропустити</span></span>${numStepper('short', s.short, 0, 180, 'Мінімальна тривалість, хвилин')}</div>
      <label class="row field-row"><span class="row-main"><span class="row-title">Показувати головні справи</span><span class="row-meta">Три пріоритети на сьогодні</span></span><input type="checkbox" class="switch" name="tasks"${s.kind === 'tasks' ? ' checked' : ''}></label>
    </div>
    <h3 class="sub-h">Пункти перевірки</h3>
    <textarea class="textarea" name="items" rows="4" maxlength="800" placeholder="Кожен пункт — з нового рядка">${esc(s.items.join('\n'))}</textarea>
    <p class="hint">Під час підготовки крок із пунктами можна завершити лише тоді, коли позначено всі пункти.</p>
    ${isNew ? '' : `<div class="row2">
      <button type="button" class="btn btn-tinted" data-act="stepMove" data-id="${esc(s.id)}" data-d="-1">${icon('up')}Вище</button>
      <button type="button" class="btn btn-tinted" data-act="stepMove" data-id="${esc(s.id)}" data-d="1">${icon('down')}Нижче</button>
    </div>
    <button type="button" class="btn btn-danger-plain btn-block" data-act="stepDelete" data-id="${esc(s.id)}">${icon('trash')}Видалити крок</button>`}
  </form>`);
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

/* ---------- Ранкова підготовка (повноекранний режим) ---------- */

let timer = 0;

function bigDur(min) {
  const t = Math.round(Math.abs(min));
  return t >= 60 ? `${Math.floor(t / 60)}<small>год</small>${String(t % 60).padStart(2, '0')}<small>хв</small>` : `${t}<small>хв</small>`;
}

function sessionRow(r, st) {
  const isCur = st.current && r.id === st.current.id;
  let meta;
  if (r.state === 'done') meta = `зроблено о ${L.fmtHM(L.localMin(r.doneAt))}`;
  else if (r.state === 'skipped') meta = 'пропущено';
  else if (r.state === 'auto') meta = 'пропускається — часу обмаль';
  else meta = `${isCur ? 'зараз' : `≈ ${L.fmtHM(r.eta)}`} · ${r.dur} хв`;
  const on = r.state === 'done';
  return `<div class="row srow" data-state="${isCur ? 'current' : r.state}">
    <button type="button" class="check${on ? ' on' : ''}" data-tone="accent" role="checkbox" aria-checked="${on}" aria-label="${esc(r.title)}" data-act="stepToggle" data-id="${esc(r.id)}"${r.state === 'auto' ? ' disabled' : ''}>${icon('check')}</button>
    <span class="row-main"><span class="row-title">${esc(r.title)}${r.critical ? icon('shield', 'crit') : ''}</span><span class="row-meta">${meta}</span></span>
  </div>`;
}

function currentCard(app, st) {
  const c = st.current;
  const idx = st.rows.filter((r) => r.state !== 'auto').findIndex((r) => r.id === c.id) + 1;
  const checks = app.state.session.checks[c.id] || [];
  const blocked = c.items.length > 0 && c.items.some((_, i) => !checks.includes(i));
  const items = c.items.length ? `<div class="subchecks">${c.items.map((it, i) => {
    const on = checks.includes(i);
    return `<button type="button" class="subcheck" role="checkbox" aria-checked="${on}" data-act="subCheck" data-id="${esc(c.id)}" data-i="${i}"><span class="check${on ? ' on' : ''}" data-tone="accent" aria-hidden="true">${icon('check')}</span><span>${esc(it)}</span></button>`;
  }).join('')}</div>` : '';
  let tasks = '';
  if (c.kind === 'tasks') {
    const focus = L.taskView(app.state.tasks, app.today).focus;
    tasks = `<div class="now-tasks">${focus.length ? focus.map((t) => `<p><span class="dot" data-tone="${L.PRIORITIES[t.pr - 1].tone}"></span>${esc(t.title)}</p>`).join('') : '<p class="muted">На сьогодні справ немає.</p>'}</div>`;
  }
  return `<section class="now-card">
    <p class="now-k">Зараз · крок ${idx} із ${st.count}</p>
    <h2 class="now-title">${esc(c.title)}${c.critical ? icon('shield', 'crit') : ''}</h2>
    <p class="now-sub">${L.fmtDur(c.left)} · орієнтовно до ${L.fmtHM(c.eta + c.left)}</p>
    ${items}${tasks}
    <div class="now-actions">
      <button type="button" class="btn btn-primary btn-lg" data-act="stepDone" data-id="${esc(c.id)}"${blocked ? ' disabled' : ''}>${icon('check')}Готово</button>
      ${c.critical ? '' : `<button type="button" class="btn btn-plain" data-act="stepSkip" data-id="${esc(c.id)}">${icon('skip')}Пропустити</button>`}
    </div>
    ${blocked ? '<p class="hint center">Позначте всі пункти перевірки.</p>' : ''}
  </section>`;
}

function finishedCard(st, session) {
  const diff = Math.round(st.depAt - L.localMin(session.finishedAt || Date.now()));
  return `<section class="now-card finished">
    <span class="big-check">${icon('check')}</span>
    <h2 class="now-title">Готові до виходу</h2>
    <p class="now-sub">${diff >= 0 ? `Запас ${L.fmtDur(diff)} до виходу о ${L.fmtHM(st.plan.departure)}` : `Пізніше запланованого на ${L.fmtDur(-diff)}`}</p>
    <button type="button" class="btn btn-primary btn-block btn-lg" data-act="closeSession">Гарного дня</button>
  </section>`;
}

function renderSession(app) {
  const d = $('#session');
  if (!d.open) return;
  const session = app.state.session;
  if (!session) { d.close(); return; }
  const st = L.sessionStatus(app.state, session, Date.now());
  const info = levelInfo(st);
  const pct = st.count ? Math.round((st.doneCount / st.count) * 100) : 100;
  const banner = !st.finished && st.level === 'tight'
    ? `<div class="banner" data-level="tight">${icon('alert')}<div><b>Не встигаєте на ${L.fmtDur(-st.spare)}.</b> Мінімальний набір кроків вкладається в час.</div><button type="button" class="btn btn-sm btn-primary" data-act="shortOn">Увімкнути</button></div>`
    : '';
  const scroll = d.querySelector('.scr')?.scrollTop || 0;
  d.innerHTML = `<div class="scr">
    <header class="scr-head">
      <button type="button" class="link" data-act="closeSession">Згорнути</button>
      <span class="scr-title">Ранкова підготовка</span>
      <button type="button" class="icon-btn" data-act="sessionReset" aria-label="Почати підготовку заново">${icon('reset')}</button>
    </header>
    <div class="scr-hero">
      <p class="scr-k">${st.toDep >= 0 ? 'До виходу' : 'Час виходу минув'}</p>
      <p class="scr-count">${bigDur(st.toDep)}</p>
      <p class="scr-sub">Вихід о ${L.fmtHM(st.plan.departure)} · прибуття ${esc(app.state.morning.arrival)}${session.date !== app.today ? ' · завтра' : ''}</p>
      ${st.finished ? '' : `<p class="pill" data-level="${info.level}">${info.text}</p>`}
    </div>
    <div class="progress" role="progressbar" aria-label="Виконано кроків" aria-valuemin="0" aria-valuemax="${st.count}" aria-valuenow="${st.doneCount}"><span style="width:${pct}%"></span></div>
    ${banner}
    ${st.finished ? finishedCard(st, session) : currentCard(app, st)}
    <h2 class="sec-h">Усі кроки<span class="sec-count">${st.doneCount} з ${st.count}</span></h2>
    <div class="list">${st.rows.map((r) => sessionRow(r, st)).join('')}</div>
    <div class="list">
      <label class="row field-row"><span class="row-main"><span class="row-title">Режим «Часу обмаль»</span><span class="row-meta">Мінімальний безпечний набір. Критичні перевірки не скорочуються.</span></span><input type="checkbox" class="switch" data-change="toggleShort"${session.short ? ' checked' : ''}></label>
    </div>
  </div>`;
  const sc = d.querySelector('.scr');
  if (sc) sc.scrollTop = scroll;
}

function openSession(app) {
  const d = $('#session');
  if (!d.open) {
    d.innerHTML = '<div class="scr"></div>';
    d.showModal();
    document.documentElement.classList.add('modal-open');
    clearInterval(timer);
    timer = setInterval(() => renderSession(app), 5000);
    d.onCloseOnce = () => { clearInterval(timer); app.render(); };
  }
  renderSession(app);
  d.querySelector('.scr')?.scrollTo(0, 0);
}

// Після кожної зміни перевіряємо, чи всі кроки завершено.
function updateSession(app, fn) {
  app.commit((s) => {
    fn(s.session);
    const st = L.sessionStatus(s, s.session, Date.now());
    s.session.finishedAt = st.finished ? s.session.finishedAt || Date.now() : 0;
  }, { render: false });
  renderSession(app);
}

const actions = {
  openStep,
  saveStep,
  startSession(app) {
    if (!L.activeSession(app.state, L.localMin())) {
      app.commit((s) => { s.session = L.newSession(s.morning, Date.now()); }, { render: false });
    }
    openSession(app);
  },
  closeSession() {
    const d = $('#session');
    if (d.open) d.close();
  },
  async sessionReset(app) {
    const ok = await confirmSheet({ title: 'Почати підготовку заново?', text: 'Позначки кроків буде скинуто.', ok: 'Почати заново' });
    if (!ok) return;
    app.commit((s) => { s.session = L.newSession(s.morning, Date.now()); }, { render: false });
    renderSession(app);
  },
  stepDone(app, el) {
    updateSession(app, (ss) => { ss.done[el.dataset.id] = Date.now(); delete ss.skipped[el.dataset.id]; });
  },
  stepSkip(app, el) {
    updateSession(app, (ss) => { ss.skipped[el.dataset.id] = true; });
  },
  stepToggle(app, el) {
    const id = el.dataset.id;
    const ss = app.state.session;
    if (ss.done[id] || ss.skipped[id]) {
      updateSession(app, (x) => { delete x.done[id]; delete x.skipped[id]; });
      return;
    }
    const step = app.state.morning.steps.find((x) => x.id === id);
    const checks = ss.checks[id] || [];
    if (step?.items.some((_, i) => !checks.includes(i))) { toast('Спершу позначте всі пункти перевірки'); return; }
    updateSession(app, (x) => { x.done[id] = Date.now(); });
  },
  subCheck(app, el) {
    const i = +el.dataset.i;
    updateSession(app, (ss) => {
      const list = new Set(ss.checks[el.dataset.id] || []);
      if (list.has(i)) list.delete(i); else list.add(i);
      ss.checks[el.dataset.id] = [...list];
    });
  },
  toggleShort(app, el) {
    updateSession(app, (ss) => { ss.short = el.checked; });
  },
  shortOn(app) {
    updateSession(app, (ss) => { ss.short = true; });
  },
  mArrival(app, el) {
    const v = L.parseHM(el.value);
    if (v == null) return;
    app.commit((s) => { s.morning.arrival = L.fmtHM(v); });
  },
  mTransport(app, el) {
    app.commit((s) => { s.morning.transport = el.dataset.v; });
  },
  mBuffer(app, el) {
    app.commit((s) => { s.morning.buffer = +el.dataset.v; });
  },
  travelStep(app, el) {
    app.commit((s) => {
      const m = s.morning;
      m.travel[m.transport] = clamp((m.travel[m.transport] || 0) + +el.dataset.d, 0, 600, 0);
    });
  },
  travelInput(app, el) {
    app.commit((s) => { s.morning.travel[s.morning.transport] = clamp(el.value, 0, 600, 0); });
  },
  numStep(app, el) {
    const input = el.parentElement.querySelector('input');
    input.value = clamp(+input.value + +el.dataset.d, +input.min, +input.max, +input.min);
  },
  stepCritical(app, el) {
    el.closest('form').dataset.critical = String(el.checked);
  },
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

export default { title: 'Ранок', render, actions, renderSession };
