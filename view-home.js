// ОПОРА 365 — «Сьогодні»: живий дашборд. Шапка дня, Day Orb, «Твоя наступна дія», хронологія.
import * as L from './logic.js';
import { esc, icon, openSheet, closeSheet, choiceSheet, toast, sheetHead, seg, haptic } from './ui.js';
import { dayOrb, heroCard, dayline, modeChip } from './components.js';
import { startMorning, completeStep } from './view-morning.js';
import { completeTaskAct, completeMustAct } from './view-tasks.js';
import { openCheckFlow } from './view-gear.js';
import { openRunScreen } from './view-deck.js';
import { openSettings } from './view-settings.js';

function orbChips(app, orb, mode) {
  const s = app.state;
  const today = app.today;
  const chips = [];
  if (orb.sub) chips.push({ ic: mode === 'rest' ? 'moon' : mode === 'ready' ? 'shieldCheck' : 'clock', html: esc(orb.sub) });
  if (mode === 'day') {
    const mv = L.mustView(s.musts, today);
    if (mv.open.length) chips.push({ ic: 'pin', html: `Обовʼязкові <b>${mv.open.length}</b>` });
  } else if (mode === 'morning') {
    const p = L.computePlan(s.morning);
    chips.push({ ic: 'flag', html: `Прибуття <b>${L.fmtHM(p.arrival)}</b>` });
  } else if (mode === 'rest') {
    const tom = L.addDays(today, 1);
    const n = s.tasks.filter((t) => !t.doneAt && t.due === tom).length;
    if (n) chips.push({ ic: 'list', html: `Завтра справ <b>${n}</b>` });
  } else if (mode === 'ready' && s.deck.active) {
    chips.push({ ic: 'play', html: 'Сценарій триває' });
  }
  return chips.slice(0, 3).map((c) => `<span class="orb-chip">${icon(c.ic)}<span>${c.html}</span></span>`).join('');
}

function installCard() {
  return `<div class="card install">
    <span class="install-ic">${icon('phone')}</span>
    <div class="install-body">
      <p class="install-t">Встановіть ОПОРА 365 на iPhone</p>
      <p class="muted">Safari → «Поділитися» → «На початковий екран». Працюйте саме з іконки: дані Safari і встановленого застосунку на iOS не спільні.</p>
    </div>
    <button type="button" class="icon-btn" data-act="hideInstall" aria-label="Сховати підказку">${icon('x')}</button>
  </div>`;
}

function render(app) {
  const nowMs = Date.now();
  const now = L.localMin(nowMs);
  const today = app.today;
  const s = app.state;
  const na = L.nextAction(s, nowMs);
  const mode = na.mode.id;
  const orb = L.orbData(s, nowMs, mode);
  const ev = L.dayEvents(s, nowMs);
  const name = s.settings.name ? `, ${esc(s.settings.name)}` : '';
  const label = `Режим «${L.MODE[mode].name}». ${orb.big} — ${orb.caption}. ${orb.sub || ''}`;
  // Хронологія — лише коли попереду є реальні події (або йде ранок).
  const timed = mode === 'morning' || ev.events.some((e) => e.t > now && !e.done);
  return `<div class="page">
    <header class="home-head">
      <p class="greet"><span>${L.greeting(L.minOfDay(now))}${name}</span><span class="clock" aria-label="Зараз ${L.fmtHM(now)}">${L.fmtHM(now)}</span></p>
      <h1 class="big-date" data-title-anchor>${L.dayMonth(today)}<small>${L.weekdayName(today)}</small></h1>
      <p class="day-sum">${esc(L.daySummary(s, nowMs))}</p>
    </header>
    <div class="orb-wrap">
      ${dayOrb(orb, { events: ev.events, nowMin: L.minOfDay(now), label })}
      <div class="orb-chips">${orbChips(app, orb, mode)}</div>
    </div>
    ${heroCard(na.main, { then: na.then })}
    ${timed && ev.events.length ? `<section class="section" aria-labelledby="dlH">
      <div class="sec-row"><h2 class="sec-h" id="dlH">Хронологія дня</h2><button type="button" class="link" data-act="tab" data-tab="tasks">Справи</button></div>
      <div class="card dayline-card">${dayline(ev)}</div>
    </section>` : ''}
    ${!app.standalone && s.settings.installHint ? installCard() : ''}
  </div>`;
}

function chrome(app) {
  return { left: modeChip(L.modeInfo(app.state)) };
}

/* ---------- Дії з картки «Твоя наступна дія» ---------- */

function findAction(app, key) {
  return L.candidates(app.state, Date.now()).find((c) => c.key === key) || null;
}

async function naDo(app, el) {
  const c = findAction(app, el.dataset.key);
  if (!c) { app.render(); return; }
  const hero = el.closest('.hero');
  switch (c.kind) {
    case 'step':
      if (c.blocked) app.go('morning');
      else { haptic(); completeStep(app, c.id); }
      break;
    case 'morning': startMorning(app); app.go('morning'); break;
    case 'gearRun': openCheckFlow(app, c.cat, hero, true); break;
    case 'gear':
      if (c.title.startsWith('Усунути')) app.go('gear', c.cat);
      else openCheckFlow(app, c.cat, hero);
      break;
    case 'deckRun': openRunScreen(app, hero); break;
    case 'task': completeTaskAct(app, c.id, hero); break;
    case 'must': completeMustAct(app, c.id, hero); break;
    case 'plan': app.go('morning'); break;
    case 'backup': openSettings(app); break;
    default: break;
  }
}

async function naDefer(app, el) {
  const key = el.dataset.key;
  const c = findAction(app, key);
  if (!c) return;
  const options = [
    { id: '30', label: 'На 30 хвилин', icon: 'alarmClock' },
    { id: '60', label: 'На 1 годину', icon: 'alarmClock' },
    { id: '180', label: 'На 3 години', icon: 'alarmClock' },
  ];
  if (c.kind === 'task') options.push({ id: 'postpone', label: 'Перенести на завтра', icon: 'arrow', hint: 'Справа отримає завтрашню дату' });
  else if (c.kind === 'morning') options.splice(0, 3, { id: 'skipMorning', label: 'Сьогодні без ранкової підготовки', icon: 'x', hint: 'Нагадування повернеться завтра' });
  else options.push({ id: 'tomorrow', label: 'До завтра', icon: 'moon' });
  const v = await choiceSheet({ title: 'Відкласти', text: c.title, options });
  if (!v) return;
  if (v === 'postpone') {
    const t = app.state.tasks.find((x) => x.id === c.id);
    if (!t) return;
    const before = { ...t };
    const next = L.postpone(t, app.today);
    app.commit(() => Object.assign(t, next));
    toast(`Перенесено: ${L.shortDate(next.due, app.today)}`, { label: 'Скасувати', run: () => app.commit(() => Object.assign(t, before)) });
    return;
  }
  app.commit((s) => {
    if (v === 'tomorrow') L.deferTomorrow(s, key);
    else if (v === 'skipMorning') {
      const sm = L.morningSummary(s, Date.now());
      s.later[key] = sm.depAt + L.GRACE;
    } else L.defer(s, key, +v);
  });
  toast(v === 'tomorrow' ? 'Відкладено до завтра' : v === 'skipMorning' ? 'Сьогодні без ранкової підготовки' : `Відкладено на ${L.fmtDur(+v)}`, { label: 'Скасувати', run: () => app.commit((s) => { delete s.later[key]; }) });
}

async function naPriority(app, el) {
  const c = findAction(app, el.dataset.key);
  if (!c) return;
  if (c.kind === 'must') {
    const v = await choiceSheet({
      title: 'Строк обовʼязкової справи', text: c.title,
      options: [
        { id: '0', label: 'Строк — сьогодні', icon: 'alert', hint: 'Підніметься на верх черги' },
        { id: '1', label: 'Строк — завтра', icon: 'calendar' },
        { id: '', label: 'Без строку', icon: 'pin' },
      ],
    });
    if (v === null) return;
    app.commit((s) => {
      const m = s.musts.find((x) => x.id === c.id);
      if (m) m.deadline = v === '' ? '' : L.addDays(app.today, +v);
    });
    return;
  }
  const t = app.state.tasks.find((x) => x.id === c.id);
  if (!t) return;
  const pinned = app.state.pin.id === t.id && app.state.pin.date === app.today;
  openSheet(`<form class="sheet-form" data-submit="naPrioritySave" data-id="${esc(t.id)}">
    ${sheetHead('Пріоритет', { cancel: 'Скасувати', done: 'Готово', submit: true })}
    <p class="sheet-text center">${esc(t.title)}</p>
    <h3 class="sub-h">Пріоритет</h3>
    ${seg('Пріоритет', L.PRIORITIES.map((p) => ({ id: p.id, name: p.short })), t.pr, 'formSeg', 'pr')}
    <input type="hidden" name="pr" value="${t.pr}">
    <div class="list" style="margin-top:16px">
      <label class="row field-row"><span class="row-main"><span class="row-title">Головне на сьогодні</span><span class="row-meta">Завжди першим у «Справах» і в наступній дії</span></span><input type="checkbox" class="switch" name="pin"${pinned ? ' checked' : ''}></label>
    </div>
  </form>`, { label: 'Пріоритет' });
}

function naPrioritySave(app, form) {
  const t = app.state.tasks.find((x) => x.id === form.dataset.id);
  if (!t) { closeSheet(); return; }
  const f = form.elements;
  app.commit((s) => {
    t.pr = Math.min(3, Math.max(1, +f.pr.value || 2));
    if (f.pin.checked) s.pin = { id: t.id, date: app.today };
    else if (s.pin.id === t.id) s.pin = { id: '', date: '' };
  });
  closeSheet();
}

/* ---------- Режим дня ---------- */

function openMode(app) {
  const mi = L.modeInfo(app.state);
  const auto = L.MODE[mi.auto];
  const row = (id, name, hint, ic, tone) => {
    const on = id === 'auto' ? !mi.manual : mi.manual && mi.id === id;
    return `<button type="button" class="row" role="radio" aria-checked="${on}" data-tone="${tone}" data-act="setModeAct" data-v="${id}">
      <span class="row-ic">${icon(ic)}</span>
      <span class="row-main"><span class="row-title">${esc(name)}</span><span class="row-meta">${esc(hint)}</span></span>
      ${on ? `<span class="tick-on">${icon('check')}</span>` : ''}
    </button>`;
  };
  openSheet(`${sheetHead('Режим дня')}
    <div class="list mode-list" role="radiogroup" aria-label="Режим дня">
      ${row('auto', 'Автоматично', `Зараз: «${auto.name}» — за часом і ранковим планом`, 'orb', 'slate')}
      ${L.MODES.map((m) => row(m.id, m.name, m.hint, m.icon, m.tone)).join('')}
    </div>
    <h3 class="sub-h">Ручний режим діє</h3>
    ${seg('Тривалість', [{ id: 'day', name: 'До кінця дня' }, { id: 'off', name: 'До скасування' }], app.ui.modeLen || 'day', 'modeLen')}
    <p class="foot">Режим змінює акценти: що показує Day Orb, яка дія стає наступною і колір інтерфейсу. Дані не змінюються.</p>`, { label: 'Режим дня' });
}

const actions = {
  naDo,
  naDefer,
  naPriority,
  naPrioritySave,
  openMode,
  modeLen(app, el) {
    app.ui.modeLen = el.dataset.v;
    el.closest('.seg').querySelectorAll('[role="radio"]').forEach((b) => b.setAttribute('aria-checked', String(b === el)));
  },
  setModeAct(app, el) {
    const id = el.dataset.v;
    app.commit((s) => L.setMode(s, id, (app.ui.modeLen || 'day') === 'day'));
    closeSheet();
    haptic();
    toast(id === 'auto' ? 'Режим визначається автоматично' : `Режим «${L.MODE[id].name}»`);
  },
  hideInstall(app) {
    app.commit((s) => { s.settings.installHint = false; });
  },
};

export default { title: 'Сьогодні', render, chrome, actions };
