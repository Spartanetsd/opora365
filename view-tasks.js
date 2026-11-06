// ОПОРА 365 — «Справи»: Priority Flow. Пошук, категорії, справи без дати, дедлайни, повторення,
// кроки, перенесення, архів; «Не забути» з явним рішенням; режим «Фокус» з таймером.
import * as L from './logic.js';
import { $, esc, icon, seg, openSheet, closeSheet, toast, sheetHead, haptic, openScreen, updateScreen, closeScreen, screenOpen, choiceSheet, confirmSheet } from './ui.js';
import { taskRow, mustRow, emptyState, miniRing, animateRings, photoHead } from './components.js';

const find = (app, id) => app.state.tasks.find((t) => t.id === id);
const findMust = (app, id) => app.state.musts.find((m) => m.id === id);
const SEGS = [
  { id: 'work', name: 'У роботі' },
  { id: 'musts', name: 'Не забути' },
  { id: 'archive', name: 'Архів' },
];

/* ---------- Екран ---------- */

function quickForm(app) {
  const chips = L.PRIORITIES.map((p) => `<button type="button" class="chip" data-tone="${p.tone}" data-act="qPr" data-v="${p.id}" aria-pressed="${app.ui.qPr === p.id}">${p.short}</button>`).join('');
  return `<form class="quick quick-full" data-submit="qAddTask" autocomplete="off">
    <div class="quick-row">
      <input id="qTask" name="title" class="quick-input" type="text" placeholder="Нова справа" maxlength="300" enterkeyhint="done" aria-label="Нова справа">
      <button type="submit" class="quick-send" aria-label="Додати справу">${icon('plus')}</button>
    </div>
    <div class="quick-opts" role="group" aria-label="Пріоритет і день">${chips}<span class="chip-sep" aria-hidden="true"></span>
      <button type="button" class="chip plain" data-act="qDay" data-v="tomorrow" aria-pressed="${app.ui.qDay === 'tomorrow'}">Завтра</button>
      <button type="button" class="chip plain" data-act="qDay" data-v="nodate" aria-pressed="${app.ui.qDay === 'nodate'}">Без дати</button>
      <button type="button" class="chip plain icon-only" data-act="openAdd" aria-label="Детальніше: дедлайн, категорія, повторення, кроки">${icon('sliders')}</button>
    </div>
  </form>`;
}

function filters(app, withCats = true) {
  const ui = app.ui;
  return `<label class="search">${icon('search')}<input id="taskSearch" type="search" placeholder="Пошук у назвах, нотатках і кроках" value="${esc(ui.taskQ)}" data-input="taskSearch" enterkeyhint="search" aria-label="Пошук справ" autocomplete="off"></label>
    ${withCats ? `<div class="chips cat-chips" role="radiogroup" aria-label="Категорія">
      <button type="button" class="chip plain" role="radio" aria-checked="${!ui.taskCat}" aria-pressed="${!ui.taskCat}" data-act="taskCat" data-v="">Усі</button>
      ${L.TASK_CATS.map((c) => `<button type="button" class="chip plain" role="radio" aria-checked="${ui.taskCat === c.id}" aria-pressed="${ui.taskCat === c.id}" data-act="taskCat" data-v="${c.id}">${icon(c.icon)}${esc(c.name)}</button>`).join('')}
    </div>` : ''}`;
}

function group(title, list, app, { id = '', open = true, note = '' } = {}) {
  if (!list.length) return '';
  const today = app.today;
  return `<section class="section"${id ? ` aria-labelledby="${id}"` : ''}>
    <div class="sec-row"><h2 class="sec-h"${id ? ` id="${id}"` : ''}>${esc(title)}<span class="sec-count">${list.length}</span></h2></div>
    ${note ? `<p class="sec-note">${note}</p>` : ''}
    ${open ? `<div class="list">${list.map((t) => taskRow(t, today, { flash: app.ui.flash })).join('')}</div>` : ''}
  </section>`;
}

function upcomingGroups(list, app) {
  if (!list.length) return '';
  const today = app.today;
  const by = new Map();
  for (const t of list) { if (!by.has(t.due)) by.set(t.due, []); by.get(t.due).push(t); }
  const blocks = [...by.entries()].map(([d, items]) => `<p class="day-h">${esc(L.shortDate(d, today).replace(/^./, (x) => x.toUpperCase()))}</p><div class="list">${items.map((t) => taskRow(t, today, { flash: app.ui.flash, showDue: false })).join('')}</div>`).join('');
  return `<section class="section" aria-labelledby="upH"><div class="sec-row"><h2 class="sec-h" id="upH">Найближчі<span class="sec-count">${list.length}</span></h2></div>${blocks}</section>`;
}

function renderWork(app) {
  return `${quickForm(app)}<div class="filters">${filters(app)}</div><div id="taskBody">${bodyWork(app)}</div>`;
}

function bodyWork(app) {
  const { taskQ: q, taskCat: cat } = app.ui;
  const tv = L.taskView(app.state.tasks, app.today, app.state.pin);
  const f = (list) => list.filter((t) => L.matches(t, q, cat));
  const overdue = f(tv.overdue), todays = f(tv.today), upcoming = f(tv.upcoming), nodate = f(tv.nodate), done = f(tv.doneToday);
  const any = overdue.length + todays.length + upcoming.length + nodate.length;
  let body;
  if (!any && (q || cat)) body = emptyState({ ic: 'search', title: 'Нічого не знайдено', text: 'Змініть запит або категорію. Виконане шукайте в архіві.' });
  else if (!any) body = emptyState({ img: 'empty-tasks.webp', title: done.length ? 'На сьогодні все важливе зроблено' : 'Справ у роботі немає', text: 'Нова справа — у полі вище. Можна без дати: вона не прострочиться.' });
  else {
    body = `${group('Прострочено', overdue, app, { id: 'odH', note: 'Дата й дедлайн лишаються такими, як були. Перенесіть або виконайте.' })}
      ${group('Сьогодні', todays, app, { id: 'tdH' })}
      ${upcomingGroups(upcoming, app)}
      ${group('Без дати', nodate, app, { id: 'ndH', note: 'Не прострочуються. Заплануйте, коли буде зрозуміло, коли.' })}`;
  }
  const doneOpen = app.ui.showDone;
  const doneBlock = done.length ? `<section class="section">
    <button type="button" class="sec-h sec-toggle" data-act="toggleDoneList" aria-expanded="${!!doneOpen}">Виконано сьогодні<span class="sec-count">${done.length}</span>${icon('down', 'sec-chev')}</button>
    ${doneOpen ? `<div class="list">${done.map((t) => taskRow(t, app.today)).join('')}</div>` : ''}
  </section>` : '';
  return `${body}${doneBlock}`;
}

function renderMusts(app) {
  return `<p class="lead-note">Справи, які не можна загубити: вони на виду, доки ви не ухвалите рішення — виконати, перенести або скасувати.</p>
    <div class="filters">${filters(app, false)}</div><div id="taskBody">${bodyMusts(app)}</div>`;
}

function bodyMusts(app) {
  const q = app.ui.taskQ;
  const mv = L.mustView(app.state.musts, app.today);
  const active = mv.active.filter((m) => L.matches(m, q));
  const parked = mv.parked.filter((m) => L.matches(m, q));
  const add = `<button type="button" class="row row-add" data-act="openAdd" data-type="must">${icon('plus')}<span>Додати до «Не забути»</span></button>`;
  return `<section class="section" aria-labelledby="maH">
      <div class="sec-row"><h2 class="sec-h" id="maH">На виду<span class="sec-count">${active.length}</span></h2></div>
      <div class="list">${active.map((m) => mustRow(m, app.today, { flash: app.ui.flash })).join('')}${add}</div>
    </section>
    ${parked.length ? `<section class="section" aria-labelledby="msH">
      <div class="sec-row"><h2 class="sec-h" id="msH">Перенесені<span class="sec-count">${parked.length}</span></h2></div>
      <p class="sec-note">Лишаються у списку й повертаються до уваги в обрану дату.</p>
      <div class="list">${parked.map((m) => mustRow(m, app.today)).join('')}</div>
    </section>` : ''}`;
}

function archiveRow(e, today) {
  const x = e.x;
  const when = L.todayKey(e.at);
  const meta = [`${e.how === 'done' ? 'виконано' : 'скасовано'} ${L.shortDate(when, today)}`];
  if (e.type === 'must') meta.push('«Не забути»');
  else if (x.cat) meta.push(L.TCAT[x.cat].name);
  return `<div class="row arow" data-how="${e.how}">
    <span class="row-lead" aria-hidden="true">${icon(e.how === 'done' ? 'checkCircle' : 'ban')}</span>
    <span class="row-main"><span class="row-title">${esc(x.title)}</span><span class="row-meta">${meta.map((m) => `<span>${esc(m)}</span>`).join('')}</span></span>
    <button type="button" class="btn btn-sm btn-quiet" data-act="restore" data-type="${e.type}" data-id="${esc(x.id)}" aria-label="Повернути в роботу: ${esc(x.title)}">${icon('undo')}</button>
  </div>`;
}

function renderArchive(app) {
  return `<div class="filters">${filters(app)}</div><div id="taskBody">${bodyArchive(app)}</div>`;
}

function bodyArchive(app) {
  const list = L.archiveView(app.state, app.ui.taskQ, app.ui.taskCat);
  const shown = list.slice(0, 150);
  return `${shown.length ? `<section class="section"><div class="sec-row"><h2 class="sec-h">Виконане й скасоване<span class="sec-count">${list.length}</span></h2></div>
      <div class="list">${shown.map((e) => archiveRow(e, app.today)).join('')}</div>
      <p class="foot">Архів зберігає записи ${L.ARCHIVE_DAYS} днів. Кнопка ${icon('undo')} повертає справу в роботу.</p></section>`
    : emptyState({ ic: 'archive', title: app.ui.taskQ || app.ui.taskCat ? 'Нічого не знайдено' : 'Архів порожній', text: 'Тут зберігаються виконані й скасовані справи.' })}`;
}

function render(app) {
  const sub = app.route.sub || 'work';
  const tv = L.taskView(app.state.tasks, app.today, app.state.pin);
  const mv = L.mustView(app.state.musts, app.today);
  const counts = { work: tv.openCount + tv.upcoming.length + tv.nodate.length, musts: mv.open.length };
  const subLine = `${L.longDate(app.today).replace(/^./, (x) => x.toUpperCase())}. ${tv.openCount ? `На сьогодні ${tv.openCount}` : 'На сьогодні вільно'}${tv.overdue.length ? `, з них прострочено ${tv.overdue.length}` : ''}`;
  const nav = `<div class="seg seg-nav" role="tablist" aria-label="Розділи справ">${SEGS.map((x) => `<button type="button" role="tab" aria-selected="${sub === x.id}" data-act="tab" data-tab="tasks" data-sub="${x.id === 'work' ? '' : x.id}"><span>${x.name}</span>${counts[x.id] ? `<span class="seg-n">${counts[x.id]}</span>` : ''}</button>`).join('')}</div>`;
  const body = sub === 'musts' ? renderMusts(app) : sub === 'archive' ? renderArchive(app) : renderWork(app);
  app.ui.flash = '';
  return `<div class="page">
    ${photoHead({ title: 'Справи', sub: esc(subLine) })}
    ${nav}
    ${body}
  </div>`;
}

function chrome(app) {
  const v = L.taskView(app.state.tasks, app.today, app.state.pin);
  return {
    right: `${v.main ? `<button type="button" class="icon-btn" data-act="focusOpen" aria-label="Режим «Фокус»">${icon('focus')}</button>` : ''}<button type="button" class="icon-btn" data-act="openAdd" aria-label="Додати справу">${icon('plus')}</button>`,
  };
}

const backdrop = () => ({ src: 'abstract-03.webp', kind: 'band', pos: 'center 40%' });

/* ---------- Додавання ---------- */

export function addTask(app, title, pr, due, extra = {}) {
  const dup = L.findDuplicate(app.state.tasks, title);
  if (dup) {
    app.ui.flash = dup.id;
    app.render();
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
    app.render();
    toast('Таке «Не забути» вже є');
    return false;
  }
  const m = L.newMust(title, deadline);
  m.note = note;
  app.ui.flash = m.id;
  app.commit((s) => s.musts.push(m));
  return m;
}

function whenField(due, today) {
  const tom = L.addDays(today, 1);
  return `<div class="due">
    <button type="button" class="chip plain" data-act="setDue" data-v="${today}" aria-pressed="${due === today}">Сьогодні</button>
    <button type="button" class="chip plain" data-act="setDue" data-v="${tom}" aria-pressed="${due === tom}">Завтра</button>
    <button type="button" class="chip plain" data-act="setDue" data-v="" aria-pressed="${!due}">Без дати</button>
    <input class="date-input" type="date" name="due" value="${esc(due)}" data-change="dueInput" aria-label="Дата">
  </div>`;
}

function catField(cat) {
  return `<div class="chips wrap" role="radiogroup" aria-label="Категорія">
    <button type="button" class="chip plain" role="radio" aria-checked="${!cat}" aria-pressed="${!cat}" data-act="catPick" data-v="">Без категорії</button>
    ${L.TASK_CATS.map((c) => `<button type="button" class="chip plain" role="radio" aria-checked="${cat === c.id}" aria-pressed="${cat === c.id}" data-act="catPick" data-v="${c.id}">${icon(c.icon)}${esc(c.name)}</button>`).join('')}
  </div><input type="hidden" name="cat" value="${esc(cat)}">`;
}

const WEEK = [1, 2, 3, 4, 5, 6, 0];
function repField(rep, due) {
  const k = rep ? rep.k : '';
  const days = rep && rep.k === 'weekly' ? rep.days : [L.weekday(due || L.todayKey())];
  return `<div class="chips wrap" role="radiogroup" aria-label="Повторення">${L.REPEATS.map((r) => `<button type="button" class="chip plain" role="radio" aria-checked="${k === r.id}" aria-pressed="${k === r.id}" data-act="repPick" data-v="${r.id}">${r.id ? icon('repeat') : ''}${esc(r.name)}</button>`).join('')}</div>
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
    <h3 class="sub-h">Коли зробити</h3>
    ${whenField(t.due, today)}
    <div class="list only-dated" style="margin-top:10px">
      <label class="row field-row"><span class="row-main"><span class="row-title">Час</span><span class="row-meta">Необовʼязково. Зʼявиться в Пульсі дня</span></span><input class="time-input" type="time" name="time" value="${esc(t.time)}"></label>
    </div>
    <h3 class="sub-h">Дедлайн</h3>
    <div class="due">
      <input class="date-input" type="date" name="deadline" value="${esc(t.deadline)}" aria-label="Дедлайн">
      <button type="button" class="chip plain" data-act="clearDate" data-name="deadline">Без дедлайну</button>
    </div>
    <p class="hint">Крайній строк. Не змінюється, коли справу переносите або коли вона прострочена.</p>
    <h3 class="sub-h">Категорія</h3>
    ${catField(t.cat)}
    <div class="only-dated">
      <h3 class="sub-h">Повторення</h3>
      ${repField(t.rep, t.due)}
    </div>
    <h3 class="sub-h">Кроки справи</h3>
    <textarea class="textarea" name="sub" rows="3" maxlength="1500" placeholder="Кожен крок — з нового рядка (необовʼязково)">${esc(sub)}</textarea>
    ${isNew ? '' : '<p class="hint">У режимі «Фокус» показується наступний невиконаний крок.</p>'}
    <h3 class="sub-h">Нотатка</h3>
    <textarea class="textarea" name="note" rows="2" maxlength="2000" placeholder="Необовʼязково">${esc(t.note)}</textarea>`;
}

function openAdd(app, el) {
  const type = el?.dataset?.type === 'must' ? 'must' : 'task';
  const today = app.today;
  const blank = { pr: 2, due: today, time: '', deadline: '', cat: '', note: '', sub: [], rep: null };
  openSheet(`
  <form class="sheet-form" data-submit="addFromSheet" data-type="${type}" data-rep="" data-nodate="false" autocomplete="off">
    ${sheetHead(type === 'must' ? 'Не забути' : 'Нова справа', { cancel: 'Скасувати', done: 'Додати', submit: true })}
    <div class="list"><label class="row field"><input class="input-plain" name="title" placeholder="${type === 'must' ? 'Що не можна забути?' : 'Що потрібно зробити?'}" maxlength="300" enterkeyhint="done" aria-label="Назва справи" data-focus></label></div>
    <div style="margin-top:12px">${seg('Тип', [{ id: 'task', name: 'Справа' }, { id: 'must', name: 'Не забути' }], type, 'formSeg', 'type')}</div>
    <input type="hidden" name="type" value="${type}">
    <div class="only-task">${taskFields(blank, today, true)}</div>
    <div class="only-must">
      <p class="hint" style="margin-top:12px">«Не забути» щодня на виду, доки ви не ухвалите рішення: виконати, перенести або скасувати.</p>
      <h3 class="sub-h">Строк — необовʼязково</h3>
      <input class="date-input wide" type="date" name="mdeadline" aria-label="Строк виконання">
      <h3 class="sub-h">Нотатка</h3>
      <textarea class="textarea" name="mnote" rows="2" maxlength="2000" placeholder="Необовʼязково"></textarea>
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

function readTaskForm(form) {
  const f = form.elements;
  const due = L.isKey(f.due.value) ? f.due.value : '';
  const repK = f.rep.value;
  const days = [...form.querySelectorAll('[data-act="dayPick"][aria-pressed="true"]')].map((b) => +b.dataset.v);
  const time = due ? L.parseHM(f.time.value) : null;
  return {
    due,
    pr: Math.min(3, Math.max(1, +f.pr.value || 2)),
    time: time == null ? '' : L.fmtHM(time),
    deadline: L.isKey(f.deadline.value) ? f.deadline.value : '',
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
    const m = addMust(app, title, L.isKey(f.mdeadline.value) ? f.mdeadline.value : '', f.mnote.value.trim().slice(0, 2000));
    if (!m) return;
    closeSheet();
    toast('Додано до «Не забути»', { label: 'Скасувати', run: () => app.commit((s) => { s.musts = s.musts.filter((x) => x.id !== m.id); }) });
    return;
  }
  const data = readTaskForm(form);
  const t = addTask(app, title, data.pr, data.due, { ...data, sub: parseSub(f.sub.value) });
  if (!t) return;
  closeSheet();
  const when = !t.due ? 'без дати' : t.due === app.today ? 'на сьогодні' : L.shortDate(t.due, app.today);
  toast(`Додано ${when}`, { label: 'Скасувати', run: () => app.commit((s) => { s.tasks = s.tasks.filter((x) => x.id !== t.id); }) });
}

/* ---------- Редагування ---------- */

function openTask(app, el) {
  const t = find(app, el.dataset.id);
  if (!t) return;
  const open = L.isOpen(t);
  const pinned = app.state.pin.id === t.id && app.state.pin.date === app.today;
  openSheet(`
  <form class="sheet-form" data-submit="saveTask" data-id="${esc(t.id)}" data-rep="${t.rep ? t.rep.k : ''}" data-nodate="${!t.due}" autocomplete="off">
    ${sheetHead('Справа', { cancel: 'Скасувати', done: 'Готово', submit: true })}
    <div class="list"><label class="row field"><input class="input-plain" name="title" value="${esc(t.title)}" maxlength="300" enterkeyhint="done" aria-label="Назва справи"></label></div>
    ${t.moved ? `<p class="hint">Переносилася: ${t.moved} ${L.plural(t.moved, ['раз', 'рази', 'разів'])}.</p>` : ''}
    ${taskFields(t, app.today, false)}
    ${open ? `<div class="list" style="margin-top:16px"><label class="row field-row"><span class="row-main"><span class="row-title">Головне на сьогодні</span><span class="row-meta">Перша серед пріоритетів і в наступній дії</span></span><input type="checkbox" class="switch" name="pin"${pinned ? ' checked' : ''}></label></div>` : ''}
    <div class="stack">
      ${open ? `<button type="button" class="btn btn-primary btn-block" data-act="focusOpen" data-id="${esc(t.id)}">${icon('focus')}Режим «Фокус»</button>
      <div class="row2" style="margin-top:0"><button type="button" class="btn btn-tinted" data-act="tPostpone" data-id="${esc(t.id)}">${icon('calendarMove')}Перенести</button><button type="button" class="btn btn-quiet" data-act="tCancel" data-id="${esc(t.id)}">${icon('ban')}Скасувати</button></div>`
      : `<button type="button" class="btn btn-tinted btn-block" data-act="restore" data-type="task" data-id="${esc(t.id)}">${icon('undo')}Повернути в роботу</button>`}
      <button type="button" class="btn btn-danger-plain btn-block" data-act="tDelete" data-id="${esc(t.id)}">${icon('trash')}Видалити назавжди</button>
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
  const data = readTaskForm(form);
  app.commit((s) => {
    Object.assign(t, data, { title: title.slice(0, 300), sub: parseSub(f.sub.value, t.sub) });
    if (f.pin) {
      if (f.pin.checked) s.pin = { id: t.id, date: app.today };
      else if (s.pin.id === t.id && s.pin.date === app.today) s.pin = { id: '', date: '' };
    }
  });
  closeSheet();
  toast('Збережено', null, 1600, 'check');
}

/* ---------- Вибір дати ---------- */

export function pickDate({ title, text = '', value = '', min = '', hint = '' }) {
  return new Promise((resolve) => {
    let answered = false;
    const d = openSheet(`<form class="sheet-form date-pick" autocomplete="off">
      ${sheetHead(title, { cancel: 'Скасувати', done: 'Готово', submit: true })}
      ${text ? `<p class="sheet-text center">${esc(text)}</p>` : ''}
      <input class="date-input wide" type="date" name="d" value="${esc(value)}"${min ? ` min="${esc(min)}"` : ''} aria-label="Дата" data-focus>
      ${hint ? `<p class="hint">${esc(hint)}</p>` : ''}
    </form>`, { onClose: () => { if (!answered) resolve(null); }, label: title });
    d.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const v = e.target.elements.d.value;
      if (!L.isKey(v)) return;
      answered = true;
      resolve(v);
      closeSheet();
    });
  });
}

const dateLabel = (key) => `${L.WD_S[L.weekday(key)]}, ${L.dayMonth(key)}`;

export async function chooseDay(app, { title, text, hint = '', deadline = '' }) {
  const today = app.today;
  const opts = [
    { id: L.addDays(today, 1), label: 'Завтра', icon: 'sunrise', hint: dateLabel(L.addDays(today, 1)) },
    { id: L.addDays(today, 3), label: 'Через 3 дні', icon: 'calendar', hint: dateLabel(L.addDays(today, 3)) },
    { id: L.addDays(today, 7), label: 'Через тиждень', icon: 'calendar', hint: dateLabel(L.addDays(today, 7)) },
    { id: 'pick', label: 'Обрати дату', icon: 'calendarMove' },
  ];
  if (deadline) for (const o of opts) if (o.id !== 'pick' && o.id > deadline) o.hint = `${o.hint}, пізніше за строк`;
  const v = await choiceSheet({ title, text, options: opts });
  if (!v) return null;
  if (v !== 'pick') return v;
  await new Promise((r) => setTimeout(r, 230));
  return pickDate({ title, text, value: L.addDays(today, 1), min: L.addDays(today, 1), hint: hint || (deadline ? `Строк не зміниться: ${L.shortDate(deadline, today)}` : '') });
}

/* ---------- Виконання й рішення ---------- */

function leave(el) {
  const card = el?.closest?.('.row, .nba');
  if (card && !card.classList.contains('nba')) card.classList.add('leaving');
  const ch = el?.classList?.contains('check') ? el : card?.querySelector('.check');
  if (ch) { ch.classList.add('on'); ch.setAttribute('aria-checked', 'true'); }
}

export function completeTaskAct(app, id, el = null) {
  const t = find(app, id);
  if (!t || !L.isOpen(t)) return;
  haptic();
  leave(el);
  setTimeout(() => {
    let res = null;
    app.commit((s) => { res = L.completeTask(s, id); });
    const label = res?.spawned ? `Виконано. Наступна — ${L.shortDate(res.spawned.due, app.today)}` : 'Виконано';
    toast(label, { label: 'Скасувати', run: () => app.commit((s) => L.undoTask(s, id)) }, 0, 'check');
  }, el ? 260 : 0);
}

export function completeMustAct(app, id, el = null) {
  const m = findMust(app, id);
  if (!m || !L.isOpen(m)) return;
  haptic();
  leave(el);
  setTimeout(() => {
    app.commit(() => { m.doneAt = Date.now(); });
    toast('Виконано', { label: 'Скасувати', run: () => app.commit(() => { m.doneAt = 0; }) }, 0, 'check');
  }, el ? 260 : 0);
}

async function mustMove(app, el) {
  const m = findMust(app, el.dataset.id);
  if (!m) return;
  const d = await chooseDay(app, { title: 'Перенести', text: `${m.title}. Залишиться у списку й повернеться до уваги в обрану дату.`, deadline: m.deadline });
  if (!d) return;
  const before = { ...m };
  app.commit(() => Object.assign(m, L.moveMust(m, d)));
  closeSheet();
  toast(`Повернеться ${L.shortDate(d, app.today)}`, { label: 'Скасувати', run: () => app.commit(() => Object.assign(m, before)) });
}

function mustCancel(app, el) {
  const m = findMust(app, el.dataset.id);
  if (!m || !L.isOpen(m)) return;
  leave(el);
  setTimeout(() => {
    app.commit(() => { m.cancelledAt = Date.now(); });
    closeSheet();
    toast('Скасовано, запис — в архіві', { label: 'Повернути', run: () => app.commit(() => { m.cancelledAt = 0; }) });
  }, 220);
}

function toggleTask(app, el) {
  const t = find(app, el.dataset.id);
  if (!t) return;
  if (t.doneAt) { app.commit((s) => L.undoTask(s, t.id)); return; }
  completeTaskAct(app, t.id, el);
}

/* ---------- «Не забути»: редагування ---------- */

function openMust(app, el) {
  const m = findMust(app, el.dataset.id);
  if (!m) return;
  const open = L.isOpen(m);
  openSheet(`
  <form class="sheet-form" data-submit="saveMust" data-id="${esc(m.id)}" autocomplete="off">
    ${sheetHead('Не забути', { cancel: 'Скасувати', done: 'Готово', submit: true })}
    <div class="list"><label class="row field"><input class="input-plain" name="title" value="${esc(m.title)}" maxlength="300" enterkeyhint="done" aria-label="Назва"></label></div>
    <h3 class="sub-h">Строк</h3>
    <div class="due">
      <input class="date-input" type="date" name="deadline" value="${esc(m.deadline)}" aria-label="Строк виконання">
      <button type="button" class="chip plain" data-act="clearDate" data-name="deadline">Без строку</button>
    </div>
    <h3 class="sub-h">Нотатка</h3>
    <textarea class="textarea" name="note" rows="3" maxlength="2000" placeholder="Необовʼязково">${esc(m.note)}</textarea>
    <p class="hint">${L.dot(`Додано ${L.shortDate(L.todayKey(m.createdAt), app.today)}${m.moved ? `, переносилося: ${m.moved}` : ''}`)} Не зникає, доки ви не вирішите.</p>
    <div class="stack">
      ${open ? `<div class="decide decide-lg" role="group" aria-label="Рішення">
        <button type="button" class="dbtn" data-tone="teal" data-act="mustDone" data-id="${esc(m.id)}">${icon('check')}<span>Виконати</span></button>
        <button type="button" class="dbtn" data-act="mustMove" data-id="${esc(m.id)}">${icon('calendarMove')}<span>Перенести</span></button>
        <button type="button" class="dbtn" data-act="mustCancel" data-id="${esc(m.id)}">${icon('ban')}<span>Скасувати</span></button>
      </div>` : `<button type="button" class="btn btn-tinted btn-block" data-act="restore" data-type="must" data-id="${esc(m.id)}">${icon('undo')}Повернути на вид</button>`}
      <button type="button" class="btn btn-danger-plain btn-block" data-act="mDelete" data-id="${esc(m.id)}">${icon('trash')}Видалити назавжди</button>
    </div>
  </form>`, { label: 'Не забути' });
}

/* ---------- Фокус ---------- */

function focusTarget(app, id) {
  const v = L.taskView(app.state.tasks, app.today, app.state.pin);
  const t = (id && find(app, id)) || v.main;
  return { t, v };
}

function timerBlock(app, t) {
  const tm = L.focusLeft(app.state, Date.now());
  if (tm && tm.id === t.id) {
    if (tm.over) {
      return `<div class="focus-timer is-over" role="status"><p class="ft-big">Час вийшов</p><p class="ft-sub">${tm.mins} хв зосередженої роботи</p>
        <div class="row2"><button type="button" class="btn btn-glass" data-act="focusTimer" data-v="5">${icon('timer')}Ще 5 хв</button><button type="button" class="btn btn-glass" data-act="focusTimer" data-v="0">Зупинити</button></div></div>`;
    }
    return `<div class="focus-timer" role="timer" aria-label="Таймер"><p class="ft-big tnum" data-count-to="${tm.end}" data-fin="1">${L.fmtClock(tm.left)}</p><p class="ft-sub">з ${tm.mins} хв</p>
      <button type="button" class="btn btn-glass btn-sm" data-act="focusTimer" data-v="0">Зупинити таймер</button></div>`;
  }
  return `<div class="focus-timer is-off"><p class="ft-sub">Таймер за бажанням</p><div class="chips center-chips">${[15, 25, 45].map((m) => `<button type="button" class="chip plain" data-act="focusTimer" data-v="${m}">${icon('timer')}${m} хв</button>`).join('')}</div></div>`;
}

function focusHtml(app, id, doneTitle = '') {
  const { t, v } = focusTarget(app, id);
  const head = '<header class="scr-head"><button type="button" class="link" data-act="focusClose">Вийти</button><span class="scr-head-t">Фокус</span><span></span></header>';
  if (!t || !L.isOpen(t)) {
    return `<div class="scr focus-scr">${head}
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
    ? `<div class="focus-next"><p class="focus-next-l">Наступний крок, ${sp.done + 1} з ${sp.total}</p><p class="focus-next-t">${esc(sp.next.t)}</p>
        <button type="button" class="btn btn-glass btn-block" data-act="focusSub" data-id="${esc(t.id)}" data-sub="${esc(sp.next.id)}">${icon('check')}Крок виконано</button></div>`
    : `<div class="focus-next"><p class="focus-next-l">Далі</p><p class="focus-next-t">${after ? esc(after.title) : 'Після цього справ на сьогодні не залишиться'}</p></div>`;
  return `<div class="scr focus-scr" data-id="${esc(t.id)}">${head}
    <div class="focus-body">
      ${sp.total ? `<div class="focus-ring">${miniRing({ key: `focus-${t.id}`, value: sp.done, total: sp.total, dim: 72, tone: 'teal' })}</div>` : ''}
      <p class="focus-kind">${t.cat ? `${icon(L.TCAT[t.cat].icon)}${esc(L.TCAT[t.cat].name)}, ` : ''}${pr.short.toLowerCase()}</p>
      <h1 class="focus-title">${esc(t.title)}</h1>
      ${info ? `<p class="focus-reason">${esc(info.text)}</p>` : ''}
      ${nextBlock}
      ${timerBlock(app, t)}
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
    from: el?.closest?.('.row, .nba') || null,
    bg: 'abstract-09.webp',
    bgPos: '70% center',
    cls: 'focus',
    onClose: () => { document.documentElement.classList.remove('focus-mode'); app.screenTick = null; app.render(); },
  });
  animateRings($('#screen'));
  app.screenTick = () => {
    const tm = L.focusLeft(app.state, Date.now());
    if (tm?.over) haptic();
    updateScreen(focusHtml(app, focusId));
    animateRings($('#screen'));
  };
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
    app.commit((s) => { res = L.completeTask(s, t.id); if (s.focus?.id === t.id) s.focus = null; }, { render: false });
    focusId = '';
    if (screenOpen()) { updateScreen(focusHtml(app, '', t.title)); animateRings($('#screen')); }
    toast(res?.spawned ? `Виконано. Наступна — ${L.shortDate(res.spawned.due, app.today)}` : 'Справу виконано', { label: 'Скасувати', run: () => { app.commit((s) => L.undoTask(s, t.id), { render: false }); focusId = t.id; updateScreen(focusHtml(app, t.id)); } }, 0, 'check');
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
  focusTimer(app, el) {
    const id = $('#screen .focus-scr')?.dataset.id;
    if (!id) return;
    const mins = +el.dataset.v;
    app.commit((s) => { s.focus = mins ? { id, start: Date.now(), mins } : null; }, { render: false });
    focusId = id;
    updateScreen(focusHtml(app, id));
  },
  qPr(app, el) {
    app.ui.qPr = +el.dataset.v;
    el.parentElement.querySelectorAll('[data-act="qPr"]').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
  },
  qDay(app, el) {
    app.ui.qDay = app.ui.qDay === el.dataset.v ? '' : el.dataset.v;
    el.parentElement.querySelectorAll('[data-act="qDay"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === app.ui.qDay)));
  },
  qAddTask(app, form) {
    const title = form.elements.title.value.trim();
    if (!title) return;
    const due = app.ui.qDay === 'tomorrow' ? L.addDays(app.today, 1) : app.ui.qDay === 'nodate' ? '' : app.today;
    if (addTask(app, title, app.ui.qPr, due)) {
      haptic();
      const fresh = document.getElementById('qTask');
      if (fresh) { fresh.value = ''; fresh.focus({ preventScroll: true }); }
    }
  },
  // Пошук оновлює лише список — поле введення й клавіатура лишаються на місці.
  taskSearch(app, el) {
    app.ui.taskQ = el.value.slice(0, 60);
    const box = document.getElementById('taskBody');
    if (!box) { app.render(); return; }
    const sub = app.route.sub || 'work';
    box.innerHTML = sub === 'musts' ? bodyMusts(app) : sub === 'archive' ? bodyArchive(app) : bodyWork(app);
  },
  taskCat(app, el) { app.ui.taskCat = el.dataset.v; app.render(); },
  formSeg(app, el) {
    const group = el.closest('.seg');
    group.querySelectorAll('[role="radio"]').forEach((b) => b.setAttribute('aria-checked', String(b === el)));
    const form = el.closest('form');
    const field = group.dataset.field;
    if (form && field) {
      if (form.elements[field]) form.elements[field].value = el.dataset.v;
      form.dataset[field] = el.dataset.v;
    }
    // Нове: заголовок і підказка поля відповідають тому, що саме додаєте.
    if (form?.dataset.submit === 'addFromSheet' && field === 'type') {
      const must = el.dataset.v === 'must';
      const t = form.closest('dialog')?.querySelector('.sheet-title');
      if (t) t.textContent = must ? 'Не забути' : 'Нова справа';
      if (form.elements.title) form.elements.title.placeholder = must ? 'Що не можна забути?' : 'Що потрібно зробити?';
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
    const form = el.closest('form');
    if (form) form.dataset.nodate = String(!el.dataset.v);
  },
  dueInput(app, el) {
    el.closest('.due').querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === el.value)));
    const form = el.closest('form');
    if (form) form.dataset.nodate = String(!el.value);
  },
  clearDate(app, el) {
    const input = el.closest('form').elements[el.dataset.name];
    if (input) input.value = '';
  },
  async tPostpone(app, el) {
    const t = find(app, el.dataset.id);
    if (!t) return;
    closeSheet();
    await new Promise((r) => setTimeout(r, 230));
    const d = await chooseDay(app, { title: 'Перенести справу', text: t.title, deadline: t.deadline });
    if (!d) return;
    const before = { ...t };
    app.commit(() => Object.assign(t, L.postpone(t, app.today, d)));
    toast(`Перенесено: ${L.shortDate(d, app.today)}`, { label: 'Скасувати', run: () => app.commit(() => Object.assign(t, before)) });
  },
  tCancel(app, el) {
    const t = find(app, el.dataset.id);
    if (!t) return;
    app.commit((s) => L.cancelTask(s, t.id));
    closeSheet();
    toast('Справу скасовано, запис — в архіві', { label: 'Повернути', run: () => app.commit((s) => L.restoreTask(s, t.id)) });
  },
  async tDelete(app, el) {
    const t = find(app, el.dataset.id);
    if (!t) return;
    const ok = await confirmSheet({ title: 'Видалити справу назавжди?', text: 'Вона зникне й з архіву. Щоб лише прибрати зі списку, оберіть «Скасувати».', ok: 'Видалити', danger: true });
    if (!ok) return;
    app.commit((s) => { s.tasks = s.tasks.filter((x) => x !== t); });
    toast('Справу видалено', { label: 'Скасувати', run: () => app.commit((s) => { s.tasks.push(t); }) });
  },
  restore(app, el) {
    const id = el.dataset.id;
    if (el.dataset.type === 'must') app.commit((s) => { const m = s.musts.find((x) => x.id === id); if (m) { m.doneAt = 0; m.cancelledAt = 0; } });
    else app.commit((s) => L.restoreTask(s, id));
    closeSheet();
    toast('Повернуто в роботу', null, 2000, 'check');
  },
  toggleDoneList(app) { app.ui.showDone = !app.ui.showDone; app.render(); },
  mustDone(app, el) { completeMustAct(app, el.dataset.id, el); closeSheet(); },
  mustMove,
  mustCancel,
  openMust,
  saveMust(app, form) {
    const m = findMust(app, form.dataset.id);
    if (!m) { closeSheet(); return; }
    const f = form.elements;
    const title = f.title.value.trim();
    if (!title) { f.title.focus(); return; }
    if (L.findDuplicate(app.state.musts, title, m.id)) { toast('Запис з такою назвою вже є'); return; }
    app.commit(() => {
      m.title = title.slice(0, 300);
      m.deadline = L.isKey(f.deadline.value) ? f.deadline.value : '';
      m.note = f.note.value.slice(0, 2000);
    });
    closeSheet();
    toast('Збережено', null, 1600, 'check');
  },
  async mDelete(app, el) {
    const m = findMust(app, el.dataset.id);
    if (!m) return;
    const ok = await confirmSheet({ title: 'Видалити назавжди?', text: 'Щоб лише прибрати зі списку, оберіть «Скасувати» — запис залишиться в архіві.', ok: 'Видалити', danger: true });
    if (!ok) return;
    app.commit((s) => { s.musts = s.musts.filter((x) => x !== m); });
    toast('Видалено', { label: 'Скасувати', run: () => app.commit((s) => { s.musts.push(m); }) });
  },
};

export default {
  title: 'Справи',
  render,
  chrome,
  backdrop,
  actions,
  validSub: (app, sub) => (sub === 'musts' || sub === 'archive' ? sub : ''),
};
