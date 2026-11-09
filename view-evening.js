// ОПОРА 365 — «Вечірній підсумок»: за 30–60 секунд. Що виконано, що залишилося, що перенести,
// що найважливіше завтра. Без оцінок продуктивності й нав’язливих повідомлень.
import * as L from './logic.js';
import * as I from './logic-ideas.js';
import { $, esc, icon, toast, haptic, openScreen, updateScreen, closeScreen, closeSheet } from './ui.js';
import { addTask, chooseDay } from './view-tasks.js';

let moved = 0;
let review = false;

function remainingRow(t, ed) {
  const pr = L.PR[t.pr];
  const late = t.due < ed.day;
  const meta = [pr.short, late ? `з ${L.shortDate(t.due, ed.day)}` : '', t.deadline ? `дедлайн ${L.shortDate(t.deadline, ed.day)}` : ''].filter(Boolean);
  return `<div class="ev-row" data-tone="${pr.tone}">
    <p class="ev-t">${esc(t.title)}</p>
    <p class="ev-m">${meta.map((m) => `<span>${esc(m)}</span>`).join('')}</p>
    <div class="ev-acts" role="group" aria-label="Рішення: ${esc(t.title)}">
      <button type="button" class="chip plain" data-act="evMove" data-id="${esc(t.id)}">${icon('sunrise')}Завтра</button>
      <button type="button" class="chip plain" data-act="evPick" data-id="${esc(t.id)}">${icon('calendarMove')}Дата</button>
      <button type="button" class="chip plain" data-act="evDone" data-id="${esc(t.id)}">${icon('check')}Зроблено</button>
      <button type="button" class="chip plain" data-act="evCancel" data-id="${esc(t.id)}">${icon('ban')}Скасувати</button>
    </div>
  </div>`;
}

function eveningHtml(app) {
  const s = app.state;
  const ed = L.eveningData(s, Date.now());
  const head = `<header class="scr-head"><button type="button" class="link" data-act="evExit">Закрити</button><span class="scr-head-t">Вечірній підсумок</span><span></span></header>`;
  const dayTitle = `${L.weekdayName(ed.day)}, ${L.dayMonth(ed.day)}`.replace(/^./, (x) => x.toUpperCase());
  const p = ed.plan;
  const end = L.endLabel(ed.tpl).toLowerCase();

  if (ed.closed && !review) {
    const at = L.kyivParts(ed.closed.at);
    return `<div class="scr evening-scr">${head}
      <div class="ev-final">
        <span class="big-check">${icon('moon')}</span>
        <h1 class="ev-title">День завершено</h1>
        <p class="ev-sub">${dayTitle}. Підсумок підбито о ${L.fmtHM(at.min)}.</p>
        <div class="ev-tomorrow"><p>Завтра: ${esc(ed.tpl.name.toLowerCase())}</p><p class="ev-times"><span>Підйом <b class="tnum">${L.fmtHM(p.wake)}</b></span><span>${esc(L.endLabel(ed.tpl))} <b class="tnum">${L.fmtHM(p.departure)}</b></span></p>
        ${ed.pinTomorrow ? `<p>Головне: ${esc(s.tasks.find((t) => t.id === ed.pinTomorrow)?.title || '')}</p>` : ''}</div>
        <p class="ev-sub">Добраніч.</p>
      </div>
      <div class="focus-actions"><button type="button" class="btn btn-primary btn-xl btn-block" data-act="evExit" data-focus>Готово</button>
      <button type="button" class="btn btn-glass btn-block" data-act="evReview">Переглянути ще раз</button></div>
    </div>`;
  }

  const done = [...ed.doneTasks.map((t) => t.title), ...ed.doneMusts.map((m) => m.title)];
  // Крок до задуму — теж зроблене за день.
  const fx = I.ideaView(s.ideas).focus;
  if (s.ideas.log[ed.day]) done.push(fx ? `Крок до задуму: ${fx.title}` : 'Крок до задуму');
  const doneBlock = `<section class="ev-card" aria-labelledby="evDoneH">
    <h2 class="ev-h" id="evDoneH">${icon('checkCircle')}Що виконано<span class="ev-n">${done.length}</span></h2>
    ${done.length ? `<ul class="ev-done">${done.slice(0, 5).map((t) => `<li>${esc(t)}</li>`).join('')}${done.length > 5 ? `<li class="ev-more">і ще ${done.length - 5}</li>` : ''}</ul>` : '<p class="ev-note">Позначених справ сьогодні немає.</p>'}
  </section>`;

  const rem = ed.remaining;
  const remBlock = `<section class="ev-card" aria-labelledby="evRemH">
    <h2 class="ev-h" id="evRemH">${icon('list')}Що залишилося<span class="ev-n">${rem.length}</span></h2>
    ${rem.length ? `<p class="ev-note">Що перенести? Дедлайни не змінюються.</p>${rem.map((t) => remainingRow(t, ed)).join('')}
      ${rem.length > 1 ? `<button type="button" class="btn btn-glass btn-block" data-act="evMoveAll">${icon('sunrise')}Усе на завтра</button>` : ''}`
    : '<p class="ev-note">Нічого не залишилося на сьогодні.</p>'}
    ${ed.musts.length ? `<p class="ev-note ev-musts">${icon('pin')}«Не забути»: ${ed.musts.length}. Лишаються на виду, доки ви не вирішите.</p>` : ''}
  </section>`;

  const tom = ed.tomorrowTasks;
  const tomBlock = `<section class="ev-card" aria-labelledby="evTomH">
    <h2 class="ev-h" id="evTomH">${icon('sunrise')}Що найважливіше завтра</h2>
    ${tom.length ? `<div class="ev-pick" role="radiogroup" aria-label="Головна справа на завтра">${tom.slice(0, 8).map((t) => `<button type="button" class="ev-opt" role="radio" aria-checked="${ed.pinTomorrow === t.id}" data-act="evPin" data-id="${esc(t.id)}"><span class="ev-radio" aria-hidden="true"></span><span>${esc(t.title)}</span></button>`).join('')}</div>`
    : '<p class="ev-note">На завтра справ поки немає.</p>'}
    <form class="quick ev-add" data-submit="evAdd" autocomplete="off"><span class="quick-ic" aria-hidden="true">${icon('plus')}</span><input class="quick-input" name="title" maxlength="300" placeholder="Справа на завтра" enterkeyhint="done" aria-label="Справа на завтра"></form>
    <p class="ev-sub-h">Ранок завтра</p>
    <div class="chips wrap" role="radiogroup" aria-label="Сценарій ранку на завтра">${s.morning.templates.map((t) => `<button type="button" class="chip plain" role="radio" aria-checked="${t.id === ed.tpl.id}" aria-pressed="${t.id === ed.tpl.id}" data-act="evTpl" data-id="${esc(t.id)}">${esc(t.name)}</button>`).join('')}</div>
    <p class="ev-times"><span>Підйом <b class="tnum">${L.fmtHM(p.wake)}</b></span><span>${esc(L.endLabel(ed.tpl))} <b class="tnum">${L.fmtHM(p.departure)}</b></span></p>
  </section>`;

  return `<div class="scr evening-scr">${head}
    <div class="ev-head"><h1 class="ev-title">${dayTitle}</h1><p class="ev-sub">Хвилина на підсумок — і можна відпочивати. Завтра ${end} о ${L.fmtHM(p.departure)}.</p></div>
    ${doneBlock}${remBlock}${tomBlock}${ideaBlock(s, ed)}
    <div class="scr-foot"><button type="button" class="btn btn-primary btn-xl btn-block" data-act="evClose">${icon('moon')}Завершити день</button></div>
  </div>`;
}

// Ідея дня: що спало на думку для творчості чи заробітку — одним рядком у скриньку «Задумів».
function ideaBlock(s, ed) {
  const today = s.ideas.list.filter((x) => L.todayKey(x.createdAt) === ed.day);
  return `<section class="ev-card" aria-labelledby="evIdeaH">
    <h2 class="ev-h" id="evIdeaH">${icon('bulb')}Ідея дня${today.length ? `<span class="ev-n">${today.length}</span>` : ''}</h2>
    <p class="ev-note">Що сьогодні спало на думку — для творчості чи заробітку? Одним рядком у «Задуми».</p>
    ${today.length ? `<ul class="ev-done">${today.slice(0, 3).map((x) => `<li>${esc(x.title)}</li>`).join('')}</ul>` : ''}
    <form class="quick ev-add" data-submit="evIdea" autocomplete="off"><span class="quick-ic" aria-hidden="true">${icon('bulb')}</span><input class="quick-input" name="title" maxlength="200" placeholder="Ідея одним рядком" enterkeyhint="done" aria-label="Ідея дня"></form>
  </section>`;
}

function refresh(app) {
  updateScreen(eveningHtml(app));
}

export function openEvening(app, from = null) {
  moved = 0;
  review = false;
  if ($('#sheet').open) closeSheet();
  openScreen(eveningHtml(app), {
    label: 'Вечірній підсумок',
    from,
    bg: 'abstract-08.webp',
    bgPos: 'center 62%',
    cls: 'evening',
    onClose: () => { app.screenTick = null; app.render(); },
  });
  app.screenTick = null;
}

const taskOf = (app, id) => app.state.tasks.find((t) => t.id === id);

const actions = {
  evExit() { closeScreen(); },
  evReview(app) { review = true; refresh(app); },
  evMove(app, el) {
    const t = taskOf(app, el.dataset.id);
    if (!t) return;
    const ed = L.eveningData(app.state, Date.now());
    app.commit(() => Object.assign(t, L.postpone(t, ed.day, ed.tomorrow)), { render: false });
    moved++;
    haptic();
    refresh(app);
  },
  async evPick(app, el) {
    const t = taskOf(app, el.dataset.id);
    if (!t) return;
    const d = await chooseDay(app, { title: 'Перенести справу', text: t.title, deadline: t.deadline });
    if (!d) return;
    const ed = L.eveningData(app.state, Date.now());
    app.commit(() => Object.assign(t, L.postpone(t, ed.day, d)), { render: false });
    moved++;
    refresh(app);
  },
  evDone(app, el) {
    const id = el.dataset.id;
    app.commit((s) => { L.completeTask(s, id); }, { render: false });
    haptic();
    refresh(app);
  },
  evCancel(app, el) {
    const id = el.dataset.id;
    app.commit((s) => { L.cancelTask(s, id); }, { render: false });
    refresh(app);
    toast('Скасовано, запис — в архіві', { label: 'Повернути', run: () => { app.commit((s) => L.restoreTask(s, id), { render: false }); refresh(app); } });
  },
  evMoveAll(app) {
    const ed = L.eveningData(app.state, Date.now());
    app.commit((s) => {
      for (const t of ed.remaining) { const x = s.tasks.find((y) => y.id === t.id); if (x) Object.assign(x, L.postpone(x, ed.day, ed.tomorrow)); }
    }, { render: false });
    moved += ed.remaining.length;
    haptic();
    refresh(app);
  },
  evPin(app, el) {
    const ed = L.eveningData(app.state, Date.now());
    const id = el.dataset.id;
    app.commit((s) => { s.pin = s.pin.id === id && s.pin.date === ed.tomorrow ? { id: '', date: '' } : { id, date: ed.tomorrow }; }, { render: false });
    refresh(app);
  },
  evIdea(app, form) {
    const title = form.elements.title.value.trim();
    if (!title) return;
    let x = null;
    app.commit((st) => { x = I.addIdea(st.ideas, title, 'create', Date.now()); }, { render: false });
    if (!x) return;
    haptic();
    refresh(app);
    toast(app.state.ideas.focus === x.id ? 'Записано — це ваш головний задум' : 'Записано в «Задуми»', null, 2000, 'bulb');
  },
  evAdd(app, form) {
    const title = form.elements.title.value.trim();
    if (!title) return;
    const ed = L.eveningData(app.state, Date.now());
    if (addTask(app, title, 2, ed.tomorrow)) refresh(app);
  },
  evTpl(app, el) {
    const sm = L.morningSummary(app.state, Date.now());
    if (sm.phase === 'running') { toast('Спершу завершіть поточну ранкову підготовку'); return; }
    app.commit((s) => { s.morning.active = el.dataset.id; }, { render: false });
    refresh(app);
  },
  evClose(app) {
    app.commit((s) => { L.closeDay(s, Date.now(), moved); }, { render: false });
    review = false;
    haptic();
    refresh(app);
    $('#screen .scr')?.scrollTo({ top: 0 });
  },
};

export default { actions };
