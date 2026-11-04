// ОПОРА — «Справи»: завдання на сьогодні за пріоритетами.
import * as L from './logic.js';
import { esc, icon, seg, checkBtn, openSheet, closeSheet, toast } from './ui.js';
import { addMust } from './view-musts.js';

const PR = Object.fromEntries(L.PRIORITIES.map((p) => [p.id, p]));
const isKey = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const find = (app, id) => app.state.tasks.find((t) => t.id === id);

export function taskMeta(t, today, showPr = true) {
  const parts = [];
  if (showPr) parts.push(`<span class="pr" data-tone="${PR[t.pr].tone}">${PR[t.pr].short}</span>`);
  if (t.due < today) {
    const n = L.diffDays(t.due, today);
    const since = n === 1 ? 'з учора' : `з ${L.shortDate(t.due, today)}`;
    parts.push(t.pr === 1 ? `<span class="warn">прострочено · ${since}</span>` : `<span>${since}</span>`);
  } else if (t.due > today) {
    parts.push(`<span>${L.shortDate(t.due, today)}</span>`);
  }
  if (t.moved) parts.push(`<span>перенесено: ${t.moved}</span>`);
  if (t.note) parts.push(`<span class="note">${esc(t.note.split('\n')[0].slice(0, 60))}</span>`);
  return parts.join('<span class="sep" aria-hidden="true">·</span>');
}

export function taskRow(t, today, { showPr = true, flash = '' } = {}) {
  const done = !!t.doneAt;
  const meta = done ? `<span>виконано о ${L.fmtHM(L.kyivParts(t.doneAt).min)}</span>` : taskMeta(t, today, showPr);
  return `<div class="row${done ? ' is-done' : ''}${flash === t.id ? ' flash' : ''}">
    ${checkBtn({ act: 'toggleTask', id: t.id, on: done, tone: PR[t.pr].tone, label: `${done ? 'Повернути' : 'Виконано'}: ${t.title}` })}
    <button type="button" class="row-main" data-act="openTask" data-id="${esc(t.id)}">
      <span class="row-title">${esc(t.title)}</span>
      ${meta ? `<span class="row-meta">${meta}</span>` : ''}
    </button>
  </div>`;
}

function section(title, items, app, { tone = '', showPr = true } = {}) {
  return `<section class="section">
    <h2 class="sec-h"${tone ? ` data-tone="${tone}"` : ''}>${tone ? '<span class="sec-dot"></span>' : ''}${esc(title)}<span class="sec-count">${items.length}</span></h2>
    <div class="list">${items.map((t) => taskRow(t, app.today, { showPr, flash: app.ui.flash })).join('')}</div>
  </section>`;
}

function quickForm(app) {
  const chips = L.PRIORITIES.map((p) => `<button type="button" class="chip" data-tone="${p.tone}" data-act="qPr" data-v="${p.id}" aria-pressed="${app.ui.qPr === p.id}">${p.short}</button>`).join('');
  return `<form class="quick" data-submit="qAddTask" autocomplete="off">
    <div class="quick-row">
      <input id="qTask" name="title" class="quick-input" type="text" placeholder="Нова справа" maxlength="300" enterkeyhint="done" aria-label="Нова справа">
      <button type="submit" class="quick-send" aria-label="Додати справу">${icon('plus')}</button>
    </div>
    <div class="quick-opts" role="group" aria-label="Пріоритет і день">${chips}<span class="chip-sep" aria-hidden="true"></span><button type="button" class="chip" data-act="qTomorrow" aria-pressed="${app.ui.qTomorrow}">Завтра</button></div>
  </form>`;
}

function render(app) {
  const today = app.today;
  const v = L.taskView(app.state.tasks, today);
  const out = [];
  if (v.overdue.length) out.push(section('Прострочено', v.overdue, app, { tone: 'red' }));
  for (const g of v.groups) if (g.items.length) out.push(section(g.name, g.items, app, { tone: g.tone, showPr: false }));
  if (!v.openCount) {
    out.push(`<div class="card empty">${icon('check', 'empty-ic')}<p class="empty-t">${v.doneToday.length ? 'Усе на сьогодні виконано' : 'На сьогодні справ немає'}</p><p class="muted">Введіть назву вгорі й натисніть «Готово» — справа одразу з’явиться тут.</p></div>`);
  }
  if (v.upcoming.length) out.push(section('Далі', v.upcoming, app));
  if (v.doneToday.length) {
    const open = app.ui.showDone;
    out.push(`<section class="section">
      <button type="button" class="sec-h sec-toggle" data-act="toggleDoneList" aria-expanded="${open}">Виконано сьогодні<span class="sec-count">${v.doneToday.length}</span>${icon(open ? 'up' : 'down', 'sec-chev')}</button>
      ${open ? `<div class="list">${v.doneToday.map((t) => taskRow(t, today)).join('')}</div>` : ''}
    </section>`);
  }
  app.ui.flash = '';
  return `<div class="page">
    <p class="eyebrow">${L.longDate(today)}</p>
    <h1 class="large-title">Справи</h1>
    ${quickForm(app)}
    ${out.join('')}
  </div>`;
}

/* ---------- Додавання ---------- */

export function addTask(app, title, pr, due, note = '') {
  const dup = L.findDuplicate(app.state.tasks, title);
  if (dup) {
    app.ui.flash = dup.id;
    app.render();
    toast('Така справа вже є в списку');
    return false;
  }
  const t = L.newTask(title, pr, due);
  t.note = note;
  app.ui.flash = t.id;
  app.commit((s) => s.tasks.push(t));
  return t;
}

function dueField(due, today) {
  const tom = L.addDays(today, 1);
  return `<div class="due">
    <button type="button" class="chip" data-act="setDue" data-v="${today}" aria-pressed="${due === today}">Сьогодні</button>
    <button type="button" class="chip" data-act="setDue" data-v="${tom}" aria-pressed="${due === tom}">Завтра</button>
    <input class="date-input" type="date" name="due" value="${esc(due)}" data-change="dueInput" aria-label="Дата">
  </div>`;
}

const prOptions = L.PRIORITIES.map((p) => ({ id: p.id, name: p.short }));

function openAdd(app) {
  const type = app.tab === 'musts' ? 'must' : 'task';
  openSheet(`
  <form class="sheet-form" data-submit="addFromSheet" data-type="${type}" autocomplete="off">
    <div class="sheet-head">
      <button type="button" class="link" data-act="sheetClose">Скасувати</button>
      <h2 class="sheet-title">Нова справа</h2>
      <button type="submit" class="link strong">Додати</button>
    </div>
    ${seg('Тип справи', [{ id: 'task', name: 'На день' }, { id: 'must', name: 'Обов’язкова' }], type, 'formSeg', 'type')}
    <input type="hidden" name="type" value="${type}">
    <div class="list"><label class="row field"><input class="input-plain" name="title" placeholder="Що потрібно зробити?" maxlength="300" enterkeyhint="done" aria-label="Назва справи" data-focus></label></div>
    <div class="only-task">
      <h3 class="sub-h">Пріоритет</h3>
      ${seg('Пріоритет', prOptions, 2, 'formSeg', 'pr')}
      <input type="hidden" name="pr" value="2">
      <h3 class="sub-h">Коли</h3>
      ${dueField(app.today, app.today)}
    </div>
    <div class="only-must">
      <h3 class="sub-h">Строк — необов’язково</h3>
      <input class="date-input wide" type="date" name="deadline" aria-label="Строк виконання">
      <p class="hint">Обов’язкова справа щодня залишається на виду, доки ви не позначите її виконаною.</p>
    </div>
    <h3 class="sub-h">Нотатка</h3>
    <textarea class="textarea" name="note" rows="2" maxlength="2000" placeholder="Необов’язково"></textarea>
  </form>`);
}

function addFromSheet(app, form) {
  const f = form.elements;
  const title = f.title.value.trim();
  if (!title) { f.title.focus(); return; }
  const note = f.note.value.trim().slice(0, 2000);
  if (f.type.value === 'must') {
    const m = addMust(app, title, isKey(f.deadline.value) ? f.deadline.value : '', note);
    if (!m) return;
    closeSheet();
    toast('Додано до обов’язкових', { label: 'Скасувати', run: () => app.commit((s) => { s.musts = s.musts.filter((x) => x.id !== m.id); }) });
  } else {
    const t = addTask(app, title, +f.pr.value || 2, isKey(f.due.value) ? f.due.value : app.today, note);
    if (!t) return;
    closeSheet();
    toast(t.due === app.today ? 'Додано на сьогодні' : `Додано: ${L.shortDate(t.due, app.today)}`, { label: 'Скасувати', run: () => app.commit((s) => { s.tasks = s.tasks.filter((x) => x.id !== t.id); }) });
  }
}

/* ---------- Редагування ---------- */

function openTask(app, el) {
  const t = find(app, el.dataset.id);
  if (!t) return;
  openSheet(`
  <form class="sheet-form" data-submit="saveTask" data-id="${esc(t.id)}" autocomplete="off">
    <div class="sheet-head">
      <button type="button" class="link" data-act="sheetClose">Скасувати</button>
      <h2 class="sheet-title">Справа</h2>
      <button type="submit" class="link strong">Готово</button>
    </div>
    <div class="list"><label class="row field"><input class="input-plain" name="title" value="${esc(t.title)}" maxlength="300" enterkeyhint="done" aria-label="Назва справи"></label></div>
    <h3 class="sub-h">Пріоритет</h3>
    ${seg('Пріоритет', prOptions, t.pr, 'formSeg', 'pr')}
    <input type="hidden" name="pr" value="${t.pr}">
    <h3 class="sub-h">Коли</h3>
    ${dueField(t.due, app.today)}
    <h3 class="sub-h">Нотатка</h3>
    <textarea class="textarea" name="note" rows="3" maxlength="2000" placeholder="Необов’язково">${esc(t.note)}</textarea>
    <div class="stack">
      ${t.doneAt ? '' : `<button type="button" class="btn btn-tinted btn-block" data-act="tPostpone" data-id="${esc(t.id)}">${icon('arrow')}Перенести на ${t.due > app.today ? 'наступний день' : 'завтра'}</button>`}
      <button type="button" class="btn btn-danger-plain btn-block" data-act="tDelete" data-id="${esc(t.id)}">${icon('trash')}Видалити справу</button>
    </div>
  </form>`);
}

function saveTask(app, form) {
  const t = find(app, form.dataset.id);
  if (!t) { closeSheet(); return; }
  const f = form.elements;
  const title = f.title.value.trim();
  if (!title) { f.title.focus(); return; }
  if (L.findDuplicate(app.state.tasks, title, t.id)) { toast('Справа з такою назвою вже є'); return; }
  app.commit(() => {
    t.title = title.slice(0, 300);
    t.pr = Math.min(3, Math.max(1, +f.pr.value || 2));
    if (isKey(f.due.value)) t.due = f.due.value;
    t.note = f.note.value.slice(0, 2000);
  });
  closeSheet();
}

function toggleTask(app, el) {
  const t = find(app, el.dataset.id);
  if (!t) return;
  if (t.doneAt) { app.commit(() => { t.doneAt = 0; }); return; }
  el.classList.add('on');
  el.setAttribute('aria-checked', 'true');
  el.closest('.row')?.classList.add('leaving');
  setTimeout(() => {
    app.commit(() => { t.doneAt = Date.now(); });
    toast('Виконано', { label: 'Скасувати', run: () => app.commit(() => { t.doneAt = 0; }) });
  }, 320);
}

const actions = {
  toggleTask,
  openTask,
  saveTask,
  openAdd,
  addFromSheet,
  qPr(app, el) {
    app.ui.qPr = +el.dataset.v;
    el.parentElement.querySelectorAll('[data-act="qPr"]').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
  },
  qTomorrow(app, el) {
    app.ui.qTomorrow = !app.ui.qTomorrow;
    el.setAttribute('aria-pressed', String(app.ui.qTomorrow));
  },
  qAddTask(app, form) {
    const input = form.elements.title;
    const title = input.value.trim();
    if (!title) return;
    if (addTask(app, title, app.ui.qPr, app.ui.qTomorrow ? L.addDays(app.today, 1) : app.today)) {
      const fresh = document.getElementById('qTask');
      if (fresh) fresh.value = '';
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
  toggleDoneList(app) {
    app.ui.showDone = !app.ui.showDone;
    app.render();
  },
};

export default { title: 'Справи', render, actions };
