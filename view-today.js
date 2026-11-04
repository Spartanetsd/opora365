// ОПОРА — «Сьогодні»: ранок, три головні справи і обов’язкове на одному екрані.
import * as L from './logic.js';
import { icon } from './ui.js';
import { morningCard } from './view-morning.js';
import { taskRow } from './view-tasks.js';
import { mustRow } from './view-musts.js';

const MUSTS_ON_TODAY = 5;

function installCard() {
  return `<div class="card install">
    <span class="install-ic">${icon('phone')}</span>
    <div class="install-body">
      <p class="install-t">Встановіть ОПОРА на iPhone</p>
      <p class="muted small">У Safari: «Поділитися» → «На початковий екран» → «Додати». Почніть роботу саме з іконки: дані Safari і встановленого застосунку не спільні.</p>
    </div>
    <button type="button" class="icon-btn" data-act="hideInstall" aria-label="Сховати підказку">${icon('x')}</button>
  </div>`;
}

function render(app) {
  const today = app.today;
  const tv = L.taskView(app.state.tasks, today);
  const mv = L.mustView(app.state.musts, today);

  const focus = tv.focus.length
    ? `<div class="list">${tv.focus.map((t) => taskRow(t, today, { flash: app.ui.flash })).join('')}</div>`
    : `<div class="card empty compact"><p class="empty-t">${tv.doneToday.length ? 'Головне на сьогодні виконано' : 'Що головне сьогодні?'}</p><p class="muted">Тут показуються три найважливіші справи: спершу прострочене й обов’язкове.</p><button type="button" class="btn btn-tinted btn-sm" data-act="openAdd">${icon('plus')}Додати справу</button></div>`;
  const moreTasks = tv.openCount > tv.focus.length
    ? `<button type="button" class="link" data-act="tab" data-tab="tasks">Усі · ${tv.openCount}</button>`
    : '';

  const shown = mv.open.slice(0, MUSTS_ON_TODAY);
  const musts = shown.length
    ? `<div class="list">${shown.map((m) => mustRow(m, today, app.ui.flash)).join('')}</div>`
    : `<div class="card empty compact"><p class="muted">Обов’язкових справ немає. Додайте те, що не можна забути, — воно залишатиметься тут, доки не виконаєте.</p><button type="button" class="btn btn-tinted btn-sm" data-act="tab" data-tab="musts">${icon('pin')}До списку</button></div>`;
  const moreMusts = mv.open.length > shown.length
    ? `<button type="button" class="link" data-act="tab" data-tab="musts">Ще ${mv.open.length - shown.length}</button>`
    : mv.open.length ? '<button type="button" class="link" data-act="tab" data-tab="musts">Усі</button>' : '';

  app.ui.flash = '';
  return `<div class="page">
    <p class="eyebrow">${L.longDate(today)}</p>
    <h1 class="large-title">Мій день</h1>
    ${!app.standalone && app.state.settings.installHint ? installCard() : ''}
    ${morningCard(app, { link: true })}
    <section class="section">
      <div class="sec-row"><h2 class="sec-h">Головне</h2>${moreTasks}</div>
      ${tv.overdue.length ? `<p class="sec-note">${icon('alert')}Прострочено: ${tv.overdue.length} — показано першими</p>` : ''}
      ${focus}
    </section>
    <section class="section">
      <div class="sec-row"><h2 class="sec-h">Не забудь</h2>${moreMusts}</div>
      ${musts}
    </section>
  </div>`;
}

const actions = {
  hideInstall(app) {
    app.commit((s) => { s.settings.installHint = false; });
  },
};

export default { title: 'Мій день', render, actions };
