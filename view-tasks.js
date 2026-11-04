// ОПОРА 365 — «Справи»: Priority Flow у три шари (головне → три пріоритети → решта),
// обовʼязкові нагадування, повторювані справи, хронологія дня і режим «Фокус».
import * as L from './logic.js';
import { $, esc, icon, seg, openSheet, closeSheet, toast, sheetHead, haptic, openScreen, updateScreen, closeScreen, screenOpen } from './ui.js';
import { priorityCard, deadlineBar, dayline, emptyState, miniRing, animateRings } from './components.js';

const find = (app, id) => app.state.tasks.find((t) => t.id === id);
const findMust = (app, id) => app.state.musts.find((m) => m.id === id);

/* ---------- Рядки списків ---------- */

export function taskRow(t, app, { flash = '' } = {}) {
  const today = app.today;
  const done = !!t.doneAt;
  const pr = L.PR[t.pr];
  const parts = [];
  if (done) parts.push(`<span>виконано о ${L.fmtHM(L.kyivParts(t.doneAt).min)}</span>`);
  else {
    parts.push(`<span class="pr" data-tone="${pr.tone}">${pr.short}</span>`);
    if (t.due > today) parts.push(`<span>${L.shortDate(t.due, today)}${t.time ? ` о ${t.time}` : ''}</span>`);
    if (t.rep) parts.push(`<span class="meta-rep">${icon('repeat')}${esc(L.repLabel(t.rep))}</span>`);
  }
  const info = done || t.due > today ? null : L.deadlineInfo(t);
  return `<div class="row${done ? ' is-done' : ''}${flash === t.id ? ' flash' : ''}" data-tone="${pr.tone}">
    <button type="button" class="check${done ? ' on' : ''}" data-tone="${pr.tone}" role="checkbox" aria-checked="${done}" aria-label="${done ? 'Повернути' : 'Виконано'}: ${esc(t.title)}" data-act="toggleTask" data-id="${esc(t.id)}">${icon('check')}</button>
    <button type="button" class="row-main" data-act="openTask" data-id="${esc(t.id)}">
      <span class="row-title">${esc(t.title)}</span>
      <span class="row-meta">${parts.join('')}</span>
      ${deadlineBar(info)}
    </button>
  </div>`;
}

export function mustRow(m, app, flash = '') {
  const today = app.today;
  const done = !!m.doneAt;
  const late = !done && m.left !== null && m.left <= 0;
  const meta = done ? `<span>виконано ${L.shortDate(L.todayKey(m.doneAt), today)}</span>`
    : `<span>${m.age === 0 ? 'додано сьогодні' : `у списку ${L.daysWord(m.age)}`}</span>`;
  return `<div class="row must-row${done ? ' is-done' : ''}${flash === m.id ? ' flash' : ''}">
    <button type="button" class="check${done ? ' on' : ''}" data-tone="${late ? 'coral' : 'teal'}" role="checkbox" aria-checked="${done}" aria-label="${done ? 'Повернути' : 'Виконано'}: ${esc(m.title)}" data-act="toggleMust" data-id="${esc(m.id)}">${icon('check')}</button>
    <button type="button" class="row-main" data-act="openMust" data-id="${esc(m.id)}">
      <span class="row-title">${esc(m.title)}</span>
      <span class="row-meta">${meta}${m.note ? `<span>${esc(m.note.split('\n')[0].slice(0, 50))}</span>` : ''}</span>
      ${done ? '' : deadlineBar(L.deadlineInfo(m, Date.now(), 'must'))}
    </button>
  </div>`;
}

/* ---------- Екран ---------- */

function quickForm(app) {
  const chips = L.PRIORITIES.map((p) => `<button type="button" class="chip" data-tone="${p.tone}" data-act="qPr" data-v="${p.id}" aria-pressed="${app.ui.qPr === p.id}">${p.short}</button>`).join('');
  return `<form class="quick" data-submit="qAddTask" autocomplete="off">
    <div class="quick-row">
      <input id="qTask" name="title" class="quick-input" type="text" placeholder="Нова справа" maxlength="300" enterkeyhint="done" aria-label="Нова справа">
      <button type="submit" class="quick-send" aria-label="Додати справу">${icon('plus')}</button>
    </div>
    <div class="quick-opts" role="group" aria-label="Пріоритет і день">${chips}<span class="chip-sep" aria-hidden="true"></span><button type="button" class="chip plain" data-act="qTomorrow" aria-pressed="${app.ui.qTomorrow}">Завтра</button><button type="button" class="chip plain" data-act="openAdd" aria-label="Детальніше: час, категорія, повторення">${icon('sliders')}</button></div>
  </form>`;
}

function render(app) {
  const today = app.today;
  const v = L.taskView(app.state.tasks, today, app.state.pin);
  const mv = L.mustView(app.state.musts, today);
  const flash = app.ui.flash;
  const ev = L.dayEvents(app.state);
  const hasTimed = ev.events.some((e) => e.kind === 'task');
  const out = [];

  if (v.main) {
    out.push(`<div class="layer-h"><span class="layer-n">1</span><span class="eyebrow">Головне</span></div>`);
    out.push(priorityCard(v.main, { today, layer: 'main', flash }));
  } else {
    out.push(`<div class="layer-h"><span class="layer-n">1</span><span class="eyebrow">Головне</span></div>`);
    out.push(emptyState({
      ic: 'check',
      title: v.doneToday.length ? 'Усе на сьогодні виконано' : 'Що головне сьогодні?',
      text: v.doneToday.length ? `Виконано: ${v.doneToday.length}. Можна відпочити або спланувати завтра.` : 'Додайте справу вгорі — найважливіша стане головною, наступні три — пріоритетами.',
    }));
  }
  if (v.top.length) {
    out.push(`<div class="layer-h"><span class="layer-n">2</span><span class="eyebrow">Пріоритети</span></div>`);
    out.push(`<div>${v.top.map((t) => priorityCard(t, { today, layer: 'top', flash })).join('')}</div>`);
  }
  if (v.more.length) {
    const open = app.ui.showMore;
    out.push(`<div><button type="button" class="more-btn" data-act="toggleMore" aria-expanded="${open}" aria-controls="moreList">${open ? 'Згорнути' : `Ще ${L.count(v.more.length, ['справа', 'справи', 'справ'])}`}${icon('down')}</button>
      <div class="expand${open ? ' open' : ''}" id="moreList"><div><div class="list">${v.more.map((t) => taskRow(t, app, { flash })).join('')}</div></div></div></div>`);
  }

  const mOpen = app.ui.showMustDone;
  const musts = `<section class="section" aria-labelledby="mustH">
    <div class="sec-row"><h2 class="sec-h" id="mustH">${icon('pin', 'must-pin')}Обовʼязкові<span class="sec-count">${mv.open.length}</span></h2><button type="button" class="link" data-act="openAdd" data-type="must">Додати</button></div>
    ${mv.open.length ? `<div class="list">${mv.open.map((m) => mustRow(m, app, flash)).join('')}</div>` : `<p class="foot" style="margin-top:0">Тут — те, що не можна забути: справа не зникає й не переноситься, доки ви її не виконаєте.</p>`}
    ${mv.done.length ? `<button type="button" class="sec-h sec-toggle" style="margin-top:12px;font-size:.95rem" data-act="toggleMustDone" aria-expanded="${mOpen}">Виконані обовʼязкові<span class="sec-count">${mv.done.length}</span>${icon('down', 'sec-chev')}</button>
      ${mOpen ? `<div class="list">${mv.done.map((m) => mustRow(m, app)).join('')}</div>` : ''}` : ''}
  </section>`;

  const upOpen = app.ui.showUpcoming;
  const upcoming = v.upcoming.length ? `<section class="section">
    <button type="button" class="sec-h sec-toggle" data-act="toggleUpcoming" aria-expanded="${upOpen}">Далі<span class="sec-count">${v.upcoming.length}</span>${icon('down', 'sec-chev')}</button>
    ${upOpen ? `<div class="list">${v.upcoming.map((t) => taskRow(t, app)).join('')}</div>` : ''}
  </section>` : '';
  const dOpen = app.ui.showDone;
  const done = v.doneToday.length ? `<section class="section">
    <button type="button" class="sec-h sec-toggle" data-act="toggleDoneList" aria-expanded="${dOpen}">Виконано сьогодні<span class="sec-count">${v.doneToday.length}</span>${icon('down', 'sec-chev')}</button>
    ${dOpen ? `<div class="list">${v.doneToday.map((t) => taskRow(t, app)).join('')}</div>` : ''}
  </section>` : '';

  app.ui.flash = '';
  return `<div class="page">
    <h1 class="large-title" data-title-anchor>Справи</h1>
    <p class="page-sub">${L.longDate(today)} · ${v.openCount ? `у роботі ${v.openCount}` : 'вільно'}${v.overdue.length ? ` · прострочено ${v.overdue.length}` : ''}</p>
    ${quickForm(app)}
    ${hasTimed ? `<section class="section" aria-label="Хронологія дня"><div class="card dayline-card">${dayline(ev, { compact: true })}</div></section>` : ''}
    <div>${out.join('')}</div>
    ${musts}
    ${upcoming}
    ${done}
  </div>`;
}

function chrome(app) {
  const v = L.taskView(app.state.tasks, app.today, app.state.pin);
  return {
    right: `${v.main ? `<button type="button" class="icon-btn" data-act="focusOpen" aria-label="Режим «Фокус»">${icon('focus')}</button>` : ''}<button type="button" class="icon-btn" data-act="openAdd" aria-label="Додати справу">${icon('plus')}</button>`,
  };
}

/* ---------- Додавання ---------- */

export function addTask(app, title, pr, due, extra = {}) {
  const dup = L.findDuplicate(app.state.tasks, title);
  if (dup) {
    app.ui.flash = dup.id;
    if (app.route.tab === 'tasks') app.render();
    toast('Така справа вже є в списку');
    return false;
  }
  const t = L.newTask(title, pr, due, Date.now(), extra);
  if (t.rep) t.sid = t.id;
  app.ui.flash = t.id;
  app.commit((s) => s.tasks.push(t));
  return t;
}

export function addMust(app, title, deadline = '', note = '') {
  const dup = L.findDuplicate(app.state.musts, title);
  if (dup) {
    app.ui.flash = dup.id;
    if (app.route.tab === 'tasks') app.render();
    toast('Така обовʼязкова справа вже є');
    return false;
  }
  const m = L.newMust(title, deadline);
  m.note = note;
  app.ui.flash = m.id;
  app.commit((s) => s.musts.push(m));
  return m;
}

function dueField(due, today) {
  const tom = L.addDays(today, 1);
  return `<div class="due">
    <button type="button" class="chip plain" data-act="setDue" data-v="${today}" aria-pressed="${due === today}">Сьогодні</button>
    <button type="button" class="chip plain" data-act="setDue" data-v="${tom}" aria-pressed="${due === tom}">Завтра</button>
    <input class="date-input" type="date" name="due" value="${esc(due)}" data-change="dueInput" aria-label="Дата">
  </div>`;
}

function catField(cat) {
  return `<div class="chips" role="radiogroup" aria-label="Категорія">
    <button type="button" class="chip plain" role="radio" aria-checked="${!cat}" aria-pressed="${!cat}" data-act="catPick" data-v="">Без категорії</button>
    ${L.TASK_CATS.map((c) => `<button type="button" class="chip plain" role="radio" aria-checked="${cat === c.id}" aria-pressed="${cat === c.id}" data-act="catPick" data-v="${c.id}">${icon(c.icon)}${esc(c.name)}</button>`).join('')}
  </div><input type="hidden" name="cat" value="${esc(cat)}">`;
}

const WEEK = [1, 2, 3, 4, 5, 6, 0];
function repField(rep, due) {
  const k = rep ? rep.k : '';
  const days = rep && rep.k === 'weekly' ? rep.days : [L.weekday(due)];
  return `<div class="chips" role="radiogroup" aria-label="Повторення">${L.REPEATS.map((r) => `<button type="button" class="chip plain" role="radio" aria-checked="${k === r.id}" aria-pressed="${k === r.id}" data-act="repPick" data-v="${r.id}">${r.id ? icon('repeat') : ''}${esc(r.name)}</button>`).join('')}</div>
    <input type="hidden" name="rep" value="${k}">
    <div class="only-weekly" style="margin-top:10px"><div class="week" role="group" aria-label="Дні тижня">${WEEK.map((d) => `<button type="button" class="chip plain" data-act="dayPick" data-v="${d}" aria-pressed="${days.includes(d)}">${L.WD_S[d]}</button>`).join('')}</div></div>
    <p class="hint only-rep">Після виконання зʼявиться наступна справа за правилом — без дублікатів.</p>`;
}

const prOptions = L.PRIORITIES.map((p) => ({ id: p.id, name: p.short }));

function taskFields(t, today, isNew) {
  const sub = t.sub.map((s) => s.t).join('\n');
  return `
    <h3 class="sub-h">Пріоритет</h3>
    ${seg('Пріоритет', prOptions, t.pr, 'formSeg', 'pr')}
    <input type="hidden" name="pr" value="${t.pr}">
    <h3 class="sub-h">Коли</h3>
    ${dueField(t.due, today)}
    <div class="list" style="margin-top:10px">
      <label class="row field-row"><span class="row-main"><span class="row-title">Час</span><span class="row-meta">Необовʼязково · зʼявиться на хронології дня</span></span><input class="time-input" type="time" name="time" value="${esc(t.time)}"></label>
    </div>
    <h3 class="sub-h">Категорія</h3>
    ${catField(t.cat)}
    <h3 class="sub-h">Повторення</h3>
    ${repField(t.rep, t.due)}
    <h3 class="sub-h">Кроки справи</h3>
    <textarea class="textarea" name="sub" rows="3" maxlength="1500" placeholder="Кожен крок — з нового рядка (необовʼязково)">${esc(sub)}</textarea>
    ${isNew ? '' : '<p class="hint">У режимі «Фокус» показується наступний невиконаний крок.</p>'}
    <h3 class="sub-h">Нотатка</h3>
    <textarea class="textarea" name="note" rows="2" maxlength="2000" placeholder="Необовʼязково">${esc(t.note)}</textarea>`;
}

function openAdd(app, el) {
  const type = el?.dataset?.type === 'must' ? 'must' : 'task';
  const today = app.today;
  const blank = { pr: 2, due: today, time: '', cat: '', note: '', sub: [], rep: null };
  openSheet(`
  <form class="sheet-form" data-submit="addFromSheet" data-type="${type}" data-rep="" autocomplete="off">
    ${sheetHead('Нова справа', { cancel: 'Скасувати', done: 'Додати', submit: true })}
    ${seg('Тип справи', [{ id: 'task', name: 'На день' }, { id: 'must', name: 'Обовʼязкова' }], type, 'formSeg', 'type')}
    <input type="hidden" name="type" value="${type}">
    <div class="list" style="margin-top:12px"><label class="row field"><input class="input-plain" name="title" placeholder="Що потрібно зробити?" maxlength="300" enterkeyhint="done" aria-label="Назва справи" data-focus></label></div>
    <div class="only-task">${taskFields(blank, today, true)}</div>
    <div class="only-must">
      <h3 class="sub-h">Строк — необовʼязково</h3>
      <input class="date-input wide" type="date" name="deadline" aria-label="Строк виконання">
      <h3 class="sub-h">Нотатка</h3>
      <textarea class="textarea" name="mnote" rows="2" maxlength="2000" placeholder="Необовʼязково"></textarea>
      <p class="hint">Обовʼязкова справа щодня на виду, доки ви не позначите її виконаною.</p>
    </div>
  </form>`, { label: 'Нова справа' });
}

function parseSub(text, old = []) {
  const lines = String(text).split('\n').map((x) => x.trim().slice(0, 120)).filter(Boolean).slice(0, 30);
  return lines.map((t) => {
    const prev = old.find((s) => s.t === t);
    return { id: prev ? prev.id : L.uid(), t, d: prev ? prev.d : 0 };
  });
}

function readTaskForm(form, due) {
  const f = form.elements;
  const repK = f.rep.value;
  const days = [...form.querySelectorAll('[data-act="dayPick"][aria-pressed="true"]')].map((b) => +b.dataset.v);
  const time = L.parseHM(f.time.value);
  return {
    pr: Math.min(3, Math.max(1, +f.pr.value || 2)),
    time: time == null ? '' : L.fmtHM(time),
    cat: L.TCAT[f.cat.value] ? f.cat.value : '',
    rep: L.makeRep(repK, due, days),
    note: f.note.value.trim().slice(0, 2000),
  };
}

function addFromSheet(app, form) {
  const f = form.elements;
  const title = f.title.value.trim();
  if (!title) { f.title.focus(); return; }
  if (f.type.value === 'must') {
    const m = addMust(app, title, L.isKey(f.deadline.value) ? f.deadline.value : '', f.mnote.value.trim().slice(0, 2000));
    if (!m) return;
    closeSheet();
    toast('Додано до обовʼязкових', { label: 'Скасувати', run: () => app.commit((s) => { s.musts = s.musts.filter((x) => x.id !== m.id); }) });
    return;
  }
  const due = L.isKey(f.due.value) ? f.due.value : app.today;
  const data = readTaskForm(form, due);
  const t = addTask(app, title, data.pr, due, { ...data, sub: parseSub(f.sub.value) });
  if (!t) return;
  closeSheet();
  toast(t.due === app.today ? 'Додано на сьогодні' : `Додано: ${L.shortDate(t.due, app.today)}`, { label: 'Скасувати', run: () => app.commit((s) => { s.tasks = s.tasks.filter((x) => x.id !== t.id); }) });
}

/* ---------- Редагування ---------- */

function openTask(app, el) {
  const t = find(app, el.dataset.id);
  if (!t) return;
  const pinned = app.state.pin.id === t.id && app.state.pin.date === app.today;
  openSheet(`
  <form class="sheet-form" data-submit="saveTask" data-id="${esc(t.id)}" data-rep="${t.rep ? t.rep.k : ''}" autocomplete="off">
    ${sheetHead('Справа', { cancel: 'Скасувати', done: 'Готово', submit: true })}
    <div class="list"><label class="row field"><input class="input-plain" name="title" value="${esc(t.title)}" maxlength="300" enterkeyhint="done" aria-label="Назва справи"></label></div>
    ${taskFields(t, app.today, false)}
    ${t.doneAt ? '' : `<div class="list" style="margin-top:16px"><label class="row field-row"><span class="row-main"><span class="row-title">Головне на сьогодні</span><span class="row-meta">Перший шар «Справ» і наступна дія</span></span><input type="checkbox" class="switch" name="pin"${pinned ? ' checked' : ''}></label></div>`}
    <div class="stack">
      ${t.doneAt ? '' : `<button type="button" class="btn btn-primary btn-block" data-act="focusOpen" data-id="${esc(t.id)}">${icon('focus')}Режим «Фокус»</button>`}
      ${t.doneAt ? '' : `<button type="button" class="btn btn-tinted btn-block" data-act="tPostpone" data-id="${esc(t.id)}">${icon('arrow')}Перенести на ${t.due > app.today ? 'наступний день' : 'завтра'}</button>`}
      <button type="button" class="btn btn-danger-plain btn-block" data-act="tDelete" data-id="${esc(t.id)}">${icon('trash')}Видалити справу</button>
    </div>
  </form>`, { label: 'Справа' });
}

function saveTask(app, form) {
  const t = find(app, form.dataset.id);
  if (!t) { closeSheet(); return; }
  const f = form.elements;
  const title = f.title.value.trim();
  if (!title) { f.title.focus(); return; }
  if (L.findDuplicate(app.state.tasks, title, t.id)) { toast('Справа з такою назвою вже є'); return; }
  const due = L.isKey(f.due.value) ? f.due.value : t.due;
  const data = readTaskForm(form, due);
  app.commit((s) => {
    Object.assign(t, data, { title: title.slice(0, 300), due, sub: parseSub(f.sub.value, t.sub) });
    if (f.pin) {
      if (f.pin.checked) s.pin = { id: t.id, date: app.today };
      else if (s.pin.id === t.id) s.pin = { id: '', date: '' };
    }
  });
  closeSheet();
}

/* ---------- Виконання ---------- */

function leave(el) {
  const card = el?.closest?.('.pcard, .row, .hero');
  if (card && !card.classList.contains('hero')) card.classList.add('leaving');
  const ch = el?.classList?.contains('check') ? el : card?.querySelector('.check');
  if (ch) { ch.classList.add('on'); ch.setAttribute('aria-checked', 'true'); }
}

export function completeTaskAct(app, id, el = null) {
  const t = find(app, id);
  if (!t || t.doneAt) return;
  haptic();
  leave(el);
  setTimeout(() => {
    let res = null;
    app.commit((s) => { res = L.completeTask(s, id); });
    const label = res?.spawned ? `Виконано · наступна ${L.shortDate(res.spawned.due, app.today)}` : 'Виконано';
    toast(label, { label: 'Скасувати', run: () => app.commit((s) => L.undoTask(s, id)) });
  }, el ? 300 : 0);
}

export function completeMustAct(app, id, el = null) {
  const m = findMust(app, id);
  if (!m || m.doneAt) return;
  haptic();
  leave(el);
  setTimeout(() => {
    app.commit(() => { m.doneAt = Date.now(); });
    toast('Обовʼязкову справу виконано', { label: 'Скасувати', run: () => app.commit(() => { m.doneAt = 0; }) });
  }, el ? 300 : 0);
}

function toggleTask(app, el) {
  const t = find(app, el.dataset.id);
  if (!t) return;
  if (t.doneAt) { app.commit((s) => L.undoTask(s, t.id)); return; }
  completeTaskAct(app, t.id, el);
}

/* ---------- Обовʼязкові ---------- */

function openMust(app, el) {
  const m = findMust(app, el.dataset.id);
  if (!m) return;
  openSheet(`
  <form class="sheet-form" data-submit="saveMust" data-id="${esc(m.id)}" autocomplete="off">
    ${sheetHead('Обовʼязкова справа', { cancel: 'Скасувати', done: 'Готово', submit: true })}
    <div class="list"><label class="row field"><input class="input-plain" name="title" value="${esc(m.title)}" maxlength="300" enterkeyhint="done" aria-label="Назва справи"></label></div>
    <h3 class="sub-h">Строк</h3>
    <div class="due">
      <input class="date-input" type="date" name="deadline" value="${esc(m.deadline)}" aria-label="Строк виконання">
      <button type="button" class="chip plain" data-act="clearDeadline">Без строку</button>
    </div>
    <h3 class="sub-h">Нотатка</h3>
    <textarea class="textarea" name="note" rows="3" maxlength="2000" placeholder="Необовʼязково">${esc(m.note)}</textarea>
    <p class="hint">Додано ${L.shortDate(L.todayKey(m.createdAt), app.today)}. Не зникає й не переноситься, доки не виконано.</p>
    <div class="stack"><button type="button" class="btn btn-danger-plain btn-block" data-act="mDelete" data-id="${esc(m.id)}">${icon('trash')}Видалити справу</button></div>
  </form>`, { label: 'Обовʼязкова справа' });
}

/* ---------- Фокус ---------- */

function focusTarget(app, id) {
  const v = L.taskView(app.state.tasks, app.today, app.state.pin);
  const t = (id && find(app, id)) || v.main;
  return { t, v };
}

function focusHtml(app, id, doneTitle = '') {
  const { t, v } = focusTarget(app, id);
  if (!t || t.doneAt) {
    return `<div class="scr focus-scr">
      <header class="scr-head"><button type="button" class="link" data-act="focusClose">Вийти</button><span class="scr-head-t">Фокус</span><span></span></header>
      <div class="focus-body">
        <span class="big-check">${icon('check')}</span>
        <h1 class="focus-title">${doneTitle ? 'Виконано' : 'Усе головне виконано'}</h1>
        <p class="focus-reason">${doneTitle ? esc(doneTitle) : 'Справ на сьогодні не залишилось.'}</p>
      </div>
      <div class="focus-actions"><button type="button" class="btn btn-primary btn-xl btn-block" data-act="focusClose" data-focus>Повернутися</button></div>
    </div>`;
  }
  const pr = L.PR[t.pr];
  const info = L.deadlineInfo(t);
  const sp = L.subProgress(t);
  const after = v.ordered.find((x) => x.id !== t.id);
  const nextBlock = sp.next
    ? `<div class="focus-next"><span class="eyebrow">Наступний крок · ${sp.done + 1}/${sp.total}</span><p>${esc(sp.next.t)}</p>
        <button type="button" class="btn btn-tinted btn-block" data-act="focusSub" data-id="${esc(t.id)}" data-sub="${esc(sp.next.id)}">${icon('check')}Крок виконано</button></div>`
    : `<div class="focus-next"><span class="eyebrow">Наступний крок</span><p>${after ? `Після цього: ${esc(after.title)}` : 'Після цього справ на сьогодні не залишиться'}</p></div>`;
  return `<div class="scr focus-scr" data-id="${esc(t.id)}">
    <header class="scr-head"><button type="button" class="link" data-act="focusClose">Вийти</button><span class="scr-head-t">Фокус</span><span></span></header>
    <div class="focus-body">
      ${sp.total ? `<div class="focus-ring">${miniRing({ key: `focus-${t.id}`, value: sp.done, total: sp.total, dim: 104 })}</div>` : ''}
      <span class="eyebrow">${t.cat ? `${icon(L.TCAT[t.cat].icon)}${esc(L.TCAT[t.cat].name)} · ` : ''}${pr.name}</span>
      <h1 class="focus-title">${esc(t.title)}</h1>
      ${info ? `<p class="focus-reason">${esc(info.text)}</p>` : ''}
      ${nextBlock}
    </div>
    <div class="focus-actions">
      <button type="button" class="btn btn-primary btn-xl btn-block" data-act="focusDone" data-id="${esc(t.id)}" data-focus>${icon('check')}Завершити справу</button>
    </div>
  </div>`;
}

let focusId = '';
function focusOpen(app, el) {
  focusId = el?.dataset?.id || '';
  if ($('#sheet').open) closeSheet();
  document.documentElement.classList.add('focus-mode');
  openScreen(focusHtml(app, focusId), {
    label: 'Режим «Фокус»',
    from: el?.closest?.('.pcard, .hero') || null,
    onClose: () => { document.documentElement.classList.remove('focus-mode'); app.screenTick = null; app.render(); },
  });
  animateRings($('#screen'));
  app.screenTick = () => { updateScreen(focusHtml(app, focusId)); animateRings($('#screen')); };
}

const actions = {
  toggleTask,
  openTask,
  saveTask,
  openAdd,
  addFromSheet,
  focusOpen,
  focusClose() { closeScreen(); },
  focusDone(app, el) {
    const t = find(app, el.dataset.id);
    if (!t) return;
    haptic();
    let res = null;
    app.commit((s) => { res = L.completeTask(s, t.id); }, { render: false });
    focusId = '';
    if (screenOpen()) { updateScreen(focusHtml(app, '', t.title)); animateRings($('#screen')); }
    toast(res?.spawned ? `Виконано · наступна ${L.shortDate(res.spawned.due, app.today)}` : 'Справу виконано', { label: 'Скасувати', run: () => { app.commit((s) => L.undoTask(s, t.id), { render: false }); focusId = t.id; updateScreen(focusHtml(app, t.id)); } });
  },
  focusSub(app, el) {
    const t = find(app, el.dataset.id);
    const s = t?.sub.find((x) => x.id === el.dataset.sub);
    if (!s) return;
    haptic();
    app.commit(() => { s.d = Date.now(); }, { render: false });
    focusId = t.id;
    updateScreen(focusHtml(app, t.id));
    animateRings($('#screen'));
  },
  qPr(app, el) {
    app.ui.qPr = +el.dataset.v;
    el.parentElement.querySelectorAll('[data-act="qPr"]').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
  },
  qTomorrow(app, el) {
    app.ui.qTomorrow = !app.ui.qTomorrow;
    el.setAttribute('aria-pressed', String(app.ui.qTomorrow));
  },
  qAddTask(app, form) {
    const title = form.elements.title.value.trim();
    if (!title) return;
    if (addTask(app, title, app.ui.qPr, app.ui.qTomorrow ? L.addDays(app.today, 1) : app.today)) {
      haptic();
      const fresh = document.getElementById('qTask');
      if (fresh) { fresh.value = ''; fresh.focus({ preventScroll: true }); }
    }
  },
  formSeg(app, el) {
    const group = el.closest('.seg');
    group.querySelectorAll('[role="radio"]').forEach((b) => b.setAttribute('aria-checked', String(b === el)));
    const form = el.closest('form');
    const field = group.dataset.field;
    if (form && field) {
      if (form.elements[field]) form.elements[field].value = el.dataset.v;
      form.dataset[field] = el.dataset.v;
    }
  },
  catPick(app, el) {
    const box = el.closest('.chips');
    box.querySelectorAll('[role="radio"]').forEach((b) => { b.setAttribute('aria-checked', String(b === el)); b.setAttribute('aria-pressed', String(b === el)); });
    el.closest('form').elements.cat.value = el.dataset.v;
  },
  repPick(app, el) {
    const box = el.closest('.chips');
    box.querySelectorAll('[role="radio"]').forEach((b) => { b.setAttribute('aria-checked', String(b === el)); b.setAttribute('aria-pressed', String(b === el)); });
    const form = el.closest('form');
    form.elements.rep.value = el.dataset.v;
    form.dataset.rep = el.dataset.v;
  },
  dayPick(app, el) {
    const on = el.getAttribute('aria-pressed') !== 'true';
    const others = [...el.parentElement.querySelectorAll('[aria-pressed="true"]')].filter((b) => b !== el);
    if (!on && !others.length) return;
    el.setAttribute('aria-pressed', String(on));
  },
  setDue(app, el) {
    const box = el.closest('.due');
    box.querySelector('input[type="date"]').value = el.dataset.v;
    box.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
  },
  dueInput(app, el) {
    el.closest('.due').querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === el.value)));
  },
  tPostpone(app, el) {
    const t = find(app, el.dataset.id);
    if (!t) return;
    const before = { ...t };
    const next = L.postpone(t, app.today);
    app.commit(() => Object.assign(t, next));
    closeSheet();
    toast(`Перенесено: ${L.shortDate(next.due, app.today)}`, { label: 'Скасувати', run: () => app.commit(() => Object.assign(t, before)) });
  },
  tDelete(app, el) {
    const t = find(app, el.dataset.id);
    if (!t) return;
    app.commit((s) => { s.tasks = s.tasks.filter((x) => x !== t); });
    closeSheet();
    toast('Справу видалено', { label: 'Скасувати', run: () => app.commit((s) => { s.tasks.push(t); }) });
  },
  toggleDoneList(app) { app.ui.showDone = !app.ui.showDone; app.render(); },
  toggleUpcoming(app) { app.ui.showUpcoming = !app.ui.showUpcoming; app.render(); },
  toggleMustDone(app) { app.ui.showMustDone = !app.ui.showMustDone; app.render(); },
  toggleMore(app, el) {
    app.ui.showMore = !app.ui.showMore;
    const box = document.getElementById('moreList');
    if (box) {
      box.classList.toggle('open', app.ui.showMore);
      el.setAttribute('aria-expanded', String(app.ui.showMore));
      const n = box.querySelectorAll('.row').length;
      el.firstChild.textContent = app.ui.showMore ? 'Згорнути' : `Ще ${L.count(n, ['справа', 'справи', 'справ'])}`;
    } else app.render();
  },
  toggleMust(app, el) {
    const m = findMust(app, el.dataset.id);
    if (!m) return;
    if (m.doneAt) { app.commit(() => { m.doneAt = 0; }); toast('Повернуто до списку'); return; }
    completeMustAct(app, m.id, el);
  },
  openMust,
  saveMust(app, form) {
    const m = findMust(app, form.dataset.id);
    if (!m) { closeSheet(); return; }
    const f = form.elements;
    const title = f.title.value.trim();
    if (!title) { f.title.focus(); return; }
    if (L.findDuplicate(app.state.musts, title, m.id)) { toast('Справа з такою назвою вже є'); return; }
    app.commit(() => {
      m.title = title.slice(0, 300);
      m.deadline = L.isKey(f.deadline.value) ? f.deadline.value : '';
      m.note = f.note.value.slice(0, 2000);
    });
    closeSheet();
  },
  clearDeadline(app, el) { el.closest('.due').querySelector('input[type="date"]').value = ''; },
  mDelete(app, el) {
    const m = findMust(app, el.dataset.id);
    if (!m) return;
    app.commit((s) => { s.musts = s.musts.filter((x) => x !== m); });
    closeSheet();
    toast('Справу видалено', { label: 'Скасувати', run: () => app.commit((s) => { s.musts.push(m); }) });
  },
};

export default { title: 'Справи', render, chrome, actions };
