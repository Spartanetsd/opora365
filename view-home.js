// ОПОРА 365 — «Сьогодні». Атмосферне зображення з датою, режимом і однією головною дією;
// нижче — Пульс дня, ранок і вечір, три пріоритети, «Не забути», швидке додавання.
import * as L from './logic.js';
import { esc, icon, openSheet, closeSheet, choiceSheet, toast, sheetHead, seg, haptic } from './ui.js';
import { nbaBlock, pulseCard, taskRow, mustRow, emptyState, modeChip } from './components.js';
import { startMorning, completeStep, openEssentials } from './view-morning.js';
import { completeTaskAct, completeMustAct, addTask } from './view-tasks.js';
import { openCheckFlow, resumeCheck } from './view-gear.js';
import { openRunScreen } from './view-deck.js';
import { openSettings } from './view-settings.js';
import { openEvening } from './view-evening.js';
import { openIdeaFocus } from './view-ideas.js';
import * as I from './logic-ideas.js';

function ritualTiles(app, nowMs) {
  const s = app.state;
  const sm = L.morningSummary(s, nowMs);
  const end = L.endLabel(sm.tpl).toLowerCase();
  let mSub;
  if (sm.phase === 'running') {
    const st = L.sessionStatus(s, sm.session, nowMs);
    mSub = st.needEss ? 'Залишилось перевірити речі' : `Крок ${st.index} із ${st.count}`;
  } else if (sm.phase === 'finished') mSub = 'Підготовку завершено';
  else if (sm.rel === 0 && sm.phase !== 'after') mSub = `Підйом о ${L.fmtHM(sm.plan.wake)}, ${end} о ${L.fmtHM(sm.plan.departure)}`;
  else mSub = `Завтра: підйом о ${L.fmtHM(sm.plan.wake)}`;
  const day = L.closeoutDay(nowMs);
  const closed = !!s.days[day];
  const mode = L.modeInfo(s, nowMs).id;
  const eSub = closed ? 'Підсумок підбито' : mode === 'evening' || mode === 'rest' ? 'Час підбити підсумок' : 'Зроблене, перенесення, завтра';
  return `<div class="rituals">
    <button type="button" class="ritual" data-act="tab" data-tab="morning">
      <img class="ritual-bg" src="abstract-05.webp" alt="" loading="lazy" decoding="async"><span class="ritual-shade" aria-hidden="true"></span>
      <span class="ritual-ic" aria-hidden="true">${icon('sunrise')}</span>
      <span class="ritual-t">Мій ранок</span>
      <span class="ritual-s">${esc(sm.tpl.name)}. ${esc(mSub)}</span>
    </button>
    <button type="button" class="ritual" data-act="eveningOpen">
      <img class="ritual-bg" src="abstract-08.webp" alt="" loading="lazy" decoding="async"><span class="ritual-shade" aria-hidden="true"></span>
      <span class="ritual-ic" aria-hidden="true">${icon(closed ? 'checkCircle' : 'moon')}</span>
      <span class="ritual-t">Вечірній підсумок</span>
      <span class="ritual-s">${esc(eSub)}</span>
    </button>
    ${ideaTile(s, nowMs)}
  </div>`;
}

// «Задуми» поруч із ранком і вечором: творче й фінансове — теж щоденний ритуал, а не «колись».
function ideaTile(s, nowMs) {
  const iv = I.ideaView(s.ideas);
  const x = iv.focus;
  let sub;
  if (x) {
    const st = I.nextStep(x);
    const state = I.stepToday(s.ideas, nowMs) ? 'сьогодні крок зроблено' : st ? `крок: ${st.t}` : 'запишіть перший маленький крок';
    sub = `${x.title} — ${state}`;
  } else sub = iv.inbox.length ? `Ідей у скриньці: ${iv.inbox.length}. Оберіть одну в роботу` : 'Творчі й фінансові ідеї — щодня по кроку';
  const ic = x ? I.IDEA_KINDS[x.kind].icon : 'spark';
  return `<button type="button" class="ritual ritual-wide" data-act="tab" data-tab="ideas">
      <img class="ritual-bg" src="abstract-02.webp" alt="" loading="lazy" decoding="async"><span class="ritual-shade" aria-hidden="true"></span>
      <span class="ritual-ic" aria-hidden="true">${icon(ic)}</span>
      <span class="ritual-t">Задуми</span>
      <span class="ritual-s">${esc(sub)}</span>
    </button>`;
}

function quickAdd(app) {
  return `<form class="quick" data-submit="hqAdd" autocomplete="off">
    <span class="quick-ic" aria-hidden="true">${icon('plus')}</span>
    <input id="hqTask" name="title" class="quick-input" type="text" placeholder="Нова справа на сьогодні" maxlength="300" enterkeyhint="done" aria-label="Нова справа на сьогодні">
    <button type="button" class="quick-more" data-act="openAdd" aria-label="Детальніше: дата, дедлайн, категорія, повторення">${icon('sliders')}</button>
  </form>`;
}

function installCard() {
  return `<div class="note-card install">
    <span class="note-ic" aria-hidden="true">${icon('phone')}</span>
    <div class="note-body">
      <p class="note-t">Встановіть ОПОРА 365 на iPhone</p>
      <p>Safari, «Поділитися», «На початковий екран». Працюйте з іконки: дані Safari і встановленого застосунку на iOS окремі.</p>
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
  const p = L.pulseData(s, nowMs);
  const tv = L.taskView(s.tasks, today, s.pin);
  const mv = L.mustView(s.musts, today);
  const flash = app.ui.flash;
  app.ui.flash = '';
  const name = s.settings.name ? `, ${esc(s.settings.name)}` : '';
  const shownId = na.main && (na.main.kind === 'task' || na.main.kind === 'must') ? na.main.id : '';
  const prio = tv.ordered.filter((t) => t.id !== shownId).slice(0, 3);
  const musts = mv.active.filter((m) => m.id !== shownId);
  const allDone = !tv.ordered.length && !mv.active.length;

  let tasksBlock = '';
  if (allDone) {
    tasksBlock = `<section class="section" aria-label="Справи на сьогодні">${emptyState({
      img: 'empty-tasks.webp',
      title: tv.doneToday.length ? 'На сьогодні все важливе зроблено' : 'На сьогодні справ немає',
      text: tv.doneToday.length ? `Виконано: ${tv.doneToday.length}. Можна відпочити або підбити підсумок.` : 'Додайте справу нижче, якщо щось потрібно встигнути.',
    })}</section>`;
  } else {
    const more = tv.ordered.length - prio.length - (shownId && tv.ordered.some((t) => t.id === shownId) ? 1 : 0);
    tasksBlock = `${prio.length ? `<section class="section" aria-labelledby="prH">
      <div class="sec-row"><h2 class="sec-h" id="prH">Пріоритети</h2><button type="button" class="link" data-act="tab" data-tab="tasks">${more > 0 ? `Ще ${more}` : 'Усі справи'}</button></div>
      <div class="list">${prio.map((t) => taskRow(t, today, { flash, nowMs })).join('')}</div>
    </section>` : ''}
    ${musts.length ? `<section class="section" aria-labelledby="mustH">
      <div class="sec-row"><h2 class="sec-h" id="mustH">${icon('pin', 'sec-ic')}Не забути<span class="sec-count">${mv.active.length}</span></h2><button type="button" class="link" data-act="openAdd" data-type="must">Додати</button></div>
      <p class="sec-note">Залишаються на виду, доки ви не вирішите: виконати, перенести чи скасувати.</p>
      <div class="list">${(app.ui.showMoreMusts ? musts : musts.slice(0, 3)).map((m) => mustRow(m, today, { flash, nowMs, deferTo: L.deferredUntil(app.state, `must:${m.id}`, nowMs) })).join('')}</div>
      ${musts.length > 3 ? `<button type="button" class="more-btn" data-act="hMoreMusts" aria-expanded="${app.ui.showMoreMusts}">${app.ui.showMoreMusts ? 'Згорнути' : `Ще ${musts.length - 3}`}${icon('down')}</button>` : ''}
    </section>` : ''}`;
  }
  const parked = mv.parked.length ? `<button type="button" class="soft-link" data-act="tab" data-tab="tasks" data-sub="musts">${icon('calendarMove')}Перенесені «Не забути»: ${mv.parked.length}</button>` : '';

  return `<div class="page page-home">
    <section class="today" aria-labelledby="todayDate">
      <div class="today-top">
        <p class="greet"><span>${L.greetingFor(na.mode.auto, L.minOfDay(now))}${name}</span><time class="clock">${L.fmtHM(now)}</time></p>
        <h1 class="today-date" id="todayDate" data-title-anchor>${L.dayMonth(today)}</h1>
        <div class="today-meta"><span class="today-wd">${L.weekdayName(today)}</span>${modeChip(na.mode)}</div>
      </div>
      ${nbaBlock(na.main, { more: na.list.length > 1 })}
    </section>
    ${pulseCard(p)}
    ${ritualTiles(app, nowMs)}
    ${tasksBlock}
    <section class="section" aria-label="Швидке додавання справи">${quickAdd(app)}${parked}</section>
    ${!app.standalone && s.settings.installHint ? installCard() : ''}
  </div>`;
}

function chrome() {
  return { right: `<button type="button" class="icon-btn" data-act="openAdd" aria-label="Додати справу">${icon('plus')}</button>` };
}

function backdrop(app) {
  return app.isLight()
    ? { src: 'light-theme.webp', kind: 'hero', pos: '96% 20%' }
    : { src: 'hero-landscape.webp', kind: 'hero', pos: '72% 50%' };
}

/* ---------- Дії з блоку «Зараз найважливіше» ---------- */

function findAction(app, key) {
  return L.candidates(app.state, Date.now()).find((c) => c.key === key) || null;
}

async function naDo(app, el) {
  const c = findAction(app, el.dataset.key);
  if (!c) { app.render(); return; }
  const from = el.closest('.nba');
  switch (c.kind) {
    case 'step':
      if (c.blocked) app.go('morning');
      else { haptic(); completeStep(app, c.id); }
      break;
    case 'ess': openEssentials(app); break;
    case 'morning': startMorning(app); app.go('morning'); break;
    case 'gearRun': resumeCheck(app, c.cat, from); break;
    case 'gear':
      if (c.fix) app.go('gear', c.cat);
      else openCheckFlow(app, c.cat, from);
      break;
    case 'deckRun': openRunScreen(app, from); break;
    case 'task': completeTaskAct(app, c.id, el); break;
    case 'must': completeMustAct(app, c.id, el); break;
    case 'evening': openEvening(app, from); break;
    case 'idea': openIdeaFocus(app, c.id, from); break;
    case 'backup': openSettings(app, 'backup'); break;
    default: break;
  }
}

async function naDefer(app, el) {
  const key = el.dataset.key;
  const c = findAction(app, key);
  if (!c) return;
  const now = Date.now();
  const t = c.kind === 'task' ? app.state.tasks.find((x) => x.id === c.id) : null;
  // Біля кожного варіанта — до котрої години: рішення видно одразу, без підрахунку в голові.
  const until = (m) => (t ? L.delayTask(t, m, now)?.time || '' : L.fmtHM(L.minOfDay(L.localMin(now)) + m));
  const options = [[30, 'На 30 хвилин'], [60, 'На 1 годину'], [180, 'На 3 години']]
    .filter(([m]) => !t || until(m))
    .map(([m, label]) => ({ id: String(m), label, icon: 'alarmClock', hint: `до ${until(m)}` }));
  if (t) options.push({ id: 'postpone', label: 'Перенести на завтра', icon: 'calendarMove', hint: 'Справа отримає завтрашню дату. Дедлайн не зміниться' });
  else if (c.kind === 'morning') options.splice(0, options.length, { id: 'skipMorning', label: 'Сьогодні без ранкової підготовки', icon: 'x', hint: 'Нагадування повернеться завтра' });
  else options.push({ id: 'tomorrow', label: 'До завтра', icon: 'moon' });
  const v = await choiceSheet({ title: 'Відкласти', text: c.title, options });
  if (!v) return;
  if (t) {
    // Справа: новий час і позначка «відкладено» або «перенесено» — їх видно і в переліку справ.
    const before = { ...t };
    const next = v === 'postpone' ? L.postpone(t, app.today) : L.delayTask(t, +v, Date.now());
    if (!next) return;
    app.commit((s) => {
      Object.assign(t, next);
      if (v === 'postpone') delete s.later[key];
      else s.later[key] = L.localAt(t.due, L.parseHM(t.time));
      if (s.pick.key === key) s.pick = { key: '', date: '' };
    });
    toast(v === 'postpone' ? `Перенесено: ${L.shortDate(next.due, app.today)}` : `Відкладено до ${next.time}`, { label: 'Скасувати', run: () => app.commit((s) => { Object.assign(t, before); delete s.later[key]; }) });
    return;
  }
  app.commit((s) => {
    if (v === 'tomorrow') L.deferTomorrow(s, key);
    else if (v === 'skipMorning') {
      const sm = L.morningSummary(s, Date.now());
      s.later[key] = sm.depAt + L.GRACE;
    } else L.defer(s, key, +v);
    if (s.pick.key === key) s.pick = { key: '', date: '' };
  });
  toast(v === 'tomorrow' ? 'Відкладено до завтра' : v === 'skipMorning' ? 'Сьогодні без ранкової підготовки' : `Відкладено до ${until(+v)}`, { label: 'Скасувати', run: () => app.commit((s) => { delete s.later[key]; }) });
}

// «Обрати іншу»: ви бачите всю чергу й причини; ваш вибір стає першим до виконання або до кінця дня.
async function naOther(app) {
  const na = L.nextAction(app.state, Date.now());
  const list = na.list.slice(0, 10);
  const picked = app.state.pick.key && app.state.pick.date === app.today;
  const options = list.map((c, i) => ({ id: c.key, label: c.title, hint: i === 0 ? `Зараз першою. ${c.reason}` : c.reason, icon: c.icon || 'arrow' }));
  if (picked) options.push({ id: '__auto', label: 'Повернути автоматичний порядок', icon: 'reset' });
  const v = await choiceSheet({ title: 'Обрати наступну дію', text: 'Порядок: ранок, події найближчої години, прострочені строки, «Обовʼязково», «Не забути», «Важливо», перевірки. Остаточне рішення — ваше.', options });
  if (!v) return;
  app.commit((s) => { s.pick = v === '__auto' ? { key: '', date: '' } : { key: v, date: app.today }; });
  haptic();
  if (v !== '__auto') toast('Наступну дію обрано', null, 2000, 'check');
}

/* ---------- Режим дня ---------- */

// Чому зараз саме цей режим і до коли — замість загального «за часом і планом».
function autoWhy(app) {
  const p = L.autoPlan(app.state);
  const end = L.homeDay(p.sm.tpl) ? 'початку дня' : 'виходу';
  const until = p.by === 'run' ? 'поки триває підготовка'
    : p.by === 'dep' ? `до ${end} о ${L.fmtHM(p.until)}`
      : p.by === 'night' ? `до ранку, ${L.fmtHM(p.until)}`
        : `до ${L.fmtHM(p.until)}`;
  return `Зараз «${L.MODE[p.id].name}», ${until}`;
}

function openMode(app) {
  const mi = L.modeInfo(app.state);
  const s = app.state.settings;
  const row = (id, name, hint, ic, tone) => {
    const on = id === 'auto' ? !mi.manual : mi.manual && mi.id === id;
    return `<button type="button" class="row row-btn mode-row" role="radio" aria-checked="${on}" data-tone="${tone}" data-act="setModeAct" data-v="${id}">
      <span class="row-ic">${icon(ic)}</span>
      <span class="row-main"><span class="row-title">${esc(name)}</span><span class="row-meta">${esc(hint)}</span></span>
      ${on ? `<span class="tick-on">${icon('check')}</span>` : ''}
    </button>`;
  };
  openSheet(`${sheetHead('Режим дня')}
    <div class="list mode-list" role="radiogroup" aria-label="Режим дня">
      ${row('auto', 'Автоматично', autoWhy(app), 'reset', 'slate')}
      ${L.MODES.map((m) => row(m.id, m.name, m.hint, m.icon, m.tone)).join('')}
    </div>
    <h3 class="sub-h">Ручний режим діє</h3>
    ${seg('Тривалість', [{ id: 'day', name: 'До кінця дня' }, { id: 'off', name: 'До скасування' }], app.ui.modeLen || 'day', 'modeLen')}
    <p class="foot">Автоматично: ранок — до ${L.homeDay(L.planTpl(app.state)) ? 'початку дня' : 'виходу'}, день — до ${esc(s.eveningAt)}, вечір — до ${esc(s.restAt)}, далі відпочинок до ранку. Час вечора й відпочинку — у налаштуваннях. Режим змінює лише акценти й порядок наступних дій.</p>`, { label: 'Режим дня' });
}

const actions = {
  naDo,
  naDefer,
  naOther,
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
    toast(id === 'auto' ? 'Режим визначається автоматично' : `Режим «${L.MODE[id].name}»`, null, 2200, 'check');
  },
  hideInstall(app) { app.commit((s) => { s.settings.installHint = false; }); },
  hMoreMusts(app) { app.ui.showMoreMusts = !app.ui.showMoreMusts; app.render(); },
  hqAdd(app, form) {
    const title = form.elements.title.value.trim();
    if (!title) return;
    if (addTask(app, title, 2, app.today)) {
      haptic();
      toast('Додано на сьогодні', null, 1800, 'check');
      const fresh = document.getElementById('hqTask');
      if (fresh) { fresh.value = ''; fresh.focus({ preventScroll: true }); }
    }
  },
  eveningOpen(app, el) { openEvening(app, el); },
};

export default { title: 'Сьогодні', render, chrome, backdrop, actions };
