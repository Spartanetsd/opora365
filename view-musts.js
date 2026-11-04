// ОПОРА — «Обов’язкові»: справи, що не зникають, доки їх не виконано.
import * as L from './logic.js';
import { esc, icon, checkBtn, openSheet, closeSheet, toast } from './ui.js';

const find = (app, id) => app.state.musts.find((m) => m.id === id);
const isKey = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const SEP = '<span class="sep" aria-hidden="true">·</span>';

export function mustMeta(m, today) {
  const parts = [m.age === 0 ? '<span>додано сьогодні</span>' : `<span>у списку ${L.daysWord(m.age)}</span>`];
  if (m.deadline) {
    if (m.left < 0) parts.push(`<span class="warn">строк минув ${L.daysWord(-m.left)} тому</span>`);
    else if (m.left === 0) parts.push('<span class="warn">строк — сьогодні</span>');
    else if (m.left === 1) parts.push('<span class="soon">строк — завтра</span>');
    else parts.push(`<span>до ${L.shortDate(m.deadline, today)} · ще ${L.daysWord(m.left)}</span>`);
  }
  if (m.note) parts.push(`<span class="note">${esc(m.note.split('\n')[0].slice(0, 60))}</span>`);
  return parts.join(SEP);
}

export function mustRow(m, today, flash = '') {
  const done = !!m.doneAt;
  const tone = !done && m.left !== null && m.left <= 0 ? 'red' : 'accent';
  const meta = done ? `<span>виконано ${L.shortDate(L.todayKey(m.doneAt), today)}</span>` : mustMeta(m, today);
  return `<div class="row${done ? ' is-done' : ''}${flash === m.id ? ' flash' : ''}">
    ${checkBtn({ act: 'toggleMust', id: m.id, on: done, tone, label: `${done ? 'Повернути' : 'Виконано'}: ${m.title}` })}
    <button type="button" class="row-main" data-act="openMust" data-id="${esc(m.id)}">
      <span class="row-title">${esc(m.title)}</span>
      <span class="row-meta">${meta}</span>
    </button>
  </div>`;
}

function render(app) {
  const today = app.today;
  const v = L.mustView(app.state.musts, today);
  const list = v.open.length
    ? `<div class="list">${v.open.map((m) => mustRow(m, today, app.ui.flash)).join('')}</div>`
    : `<div class="card empty">${icon('pin', 'empty-ic')}<p class="empty-t">Список порожній</p><p class="muted">Додайте справу, яку не можна забути: вона щодня буде на екрані «Сьогодні», доки ви її не виконаєте.</p></div>`;
  const open = app.ui.showMustDone;
  const done = v.done.length ? `<section class="section">
      <button type="button" class="sec-h sec-toggle" data-act="toggleMustDone" aria-expanded="${open}">Виконані<span class="sec-count">${v.done.length}</span>${icon(open ? 'up' : 'down', 'sec-chev')}</button>
      ${open ? `<div class="list">${v.done.map((m) => mustRow(m, today)).join('')}</div><p class="foot">Виконані зберігаються 30 днів. Натисніть на кружечок, щоб повернути справу.</p>` : ''}
    </section>` : '';
  app.ui.flash = '';
  return `<div class="page">
    <p class="eyebrow">Не зникають, доки не виконано</p>
    <h1 class="large-title">Обов’язкові</h1>
    <form class="quick" data-submit="qAddMust" autocomplete="off">
      <div class="quick-row">
        <input id="qMust" name="title" class="quick-input" type="text" placeholder="Нова обов’язкова справа" maxlength="300" enterkeyhint="done" aria-label="Нова обов’язкова справа">
        <button type="submit" class="quick-send" aria-label="Додати обов’язкову справу">${icon('plus')}</button>
      </div>
    </form>
    <section class="section">
      <h2 class="sec-h">У роботі<span class="sec-count">${v.open.length}</span></h2>
      ${list}
      <p class="foot">Ці справи не переносяться і не зникають з дня на день. Строк можна додати, натиснувши на справу.</p>
    </section>
    ${done}
  </div>`;
}

export function addMust(app, title, deadline = '', note = '') {
  const dup = L.findDuplicate(app.state.musts, title);
  if (dup) {
    app.ui.flash = dup.id;
    app.render();
    toast('Така обов’язкова справа вже є');
    return false;
  }
  const m = L.newMust(title, deadline);
  m.note = note;
  app.ui.flash = m.id;
  app.commit((s) => s.musts.push(m));
  return m;
}

function openMust(app, el) {
  const m = find(app, el.dataset.id);
  if (!m) return;
  openSheet(`
  <form class="sheet-form" data-submit="saveMust" data-id="${esc(m.id)}" autocomplete="off">
    <div class="sheet-head">
      <button type="button" class="link" data-act="sheetClose">Скасувати</button>
      <h2 class="sheet-title">Обов’язкова справа</h2>
      <button type="submit" class="link strong">Готово</button>
    </div>
    <div class="list"><label class="row field"><input class="input-plain" name="title" value="${esc(m.title)}" maxlength="300" enterkeyhint="done" aria-label="Назва справи"></label></div>
    <h3 class="sub-h">Строк</h3>
    <div class="due">
      <input class="date-input" type="date" name="deadline" value="${esc(m.deadline)}" aria-label="Строк виконання">
      <button type="button" class="chip" data-act="clearDeadline">Без строку</button>
    </div>
    <h3 class="sub-h">Нотатка</h3>
    <textarea class="textarea" name="note" rows="3" maxlength="2000" placeholder="Необов’язково">${esc(m.note)}</textarea>
    <p class="hint">Додано ${L.shortDate(L.todayKey(m.createdAt), app.today)}.</p>
    <div class="stack">
      <button type="button" class="btn btn-danger-plain btn-block" data-act="mDelete" data-id="${esc(m.id)}">${icon('trash')}Видалити справу</button>
    </div>
  </form>`);
}

function toggleMust(app, el) {
  const m = find(app, el.dataset.id);
  if (!m) return;
  if (m.doneAt) { app.commit(() => { m.doneAt = 0; }); toast('Повернуто до списку'); return; }
  el.classList.add('on');
  el.setAttribute('aria-checked', 'true');
  el.closest('.row')?.classList.add('leaving');
  setTimeout(() => {
    app.commit(() => { m.doneAt = Date.now(); });
    toast('Обов’язкову справу виконано', { label: 'Скасувати', run: () => app.commit(() => { m.doneAt = 0; }) });
  }, 320);
}

const actions = {
  toggleMust,
  openMust,
  qAddMust(app, form) {
    const title = form.elements.title.value.trim();
    if (!title) return;
    if (addMust(app, title)) {
      const fresh = document.getElementById('qMust');
      if (fresh) fresh.value = '';
    }
  },
  saveMust(app, form) {
    const m = find(app, form.dataset.id);
    if (!m) { closeSheet(); return; }
    const f = form.elements;
    const title = f.title.value.trim();
    if (!title) { f.title.focus(); return; }
    if (L.findDuplicate(app.state.musts, title, m.id)) { toast('Справа з такою назвою вже є'); return; }
    app.commit(() => {
      m.title = title.slice(0, 300);
      m.deadline = isKey(f.deadline.value) ? f.deadline.value : '';
      m.note = f.note.value.slice(0, 2000);
    });
    closeSheet();
  },
  clearDeadline(app, el) {
    el.closest('.due').querySelector('input[type="date"]').value = '';
  },
  mDelete(app, el) {
    const m = find(app, el.dataset.id);
    if (!m) return;
    app.commit((s) => { s.musts = s.musts.filter((x) => x !== m); });
    closeSheet();
    toast('Справу видалено', { label: 'Скасувати', run: () => app.commit((s) => { s.musts.push(m); }) });
  },
  toggleMustDone(app) {
    app.ui.showMustDone = !app.ui.showMustDone;
    app.render();
  },
};

export default { title: 'Обов’язкові', render, actions };
