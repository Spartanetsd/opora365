// ОПОРА 365 — «Задуми»: творчі й фінансові ідеї поза службою й побутом.
// Одна ідея в роботі, щодня — маленький крок, решта чекає в скриньці; готове — «Відвантажено».
import * as L from './logic.js';
import * as I from './logic-ideas.js';
import { $, esc, icon, typo, seg, openSheet, closeSheet, confirmSheet, toast, sheetHead, haptic, openScreen, updateScreen, closeScreen, screenOpen, sortable, growSteps } from './ui.js';
import { photoHead, emptyState } from './components.js';

const WD1 = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const find = (app, id) => I.findIdea(app.state.ideas, id);
const kindOf = (x) => I.IDEA_KINDS[x.kind] || I.IDEA_KINDS.create;

// Сім днів: крапка заповнена — у той день був крок. Справжні дні, без балів і «серій».
function weekDots(ideas, today) {
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(L.addDays(today, -i));
  const n = days.filter((d) => ideas.log[d]).length;
  return `<div class="ideas-week" role="img" aria-label="Кроки до задуму за 7 днів: ${n} з 7">
    ${days.map((d) => `<span class="iw-day${ideas.log[d] ? ' on' : ''}${d === today ? ' is-cur' : ''}" aria-hidden="true"><i></i><b>${WD1[L.weekday(d)]}</b></span>`).join('')}
  </div>`;
}

function focusCard(app, iv) {
  const ideas = app.state.ideas;
  const today = app.today;
  if (!iv.focus) {
    const next = iv.inbox[0];
    return `<div class="idea-focus is-empty">
      <p class="if-lead">${icon('spark')}Головний задум</p>
      <h2 class="if-title">${next ? 'Оберіть, над чим працювати' : 'Яку справу свого життя ви відкладаєте?'}</h2>
      <p class="if-sub">${next ? 'Одна ідея в роботі — решта чекає. Торкніться ідеї в скриньці й зробіть її головною.' : 'Запишіть ідею нижче — творчу чи фінансову. Перша стане головним задумом.'}</p>
      ${next ? `<button type="button" class="btn btn-primary btn-block" data-act="ideaMakeFocus" data-id="${esc(next.id)}">${icon('spark')}Взяти в роботу: ${esc(next.title.length > 28 ? next.title.slice(0, 27) + '…' : next.title)}</button>` : ''}
    </div>`;
  }
  const x = iv.focus;
  const k = kindOf(x);
  const st = I.nextStep(x);
  const doneSteps = x.steps.filter((s) => s.doneAt).length;
  const age = Math.max(0, L.diffDays(L.todayKey(x.createdAt), today));
  const todayDone = I.stepToday(ideas, Date.now());
  const meta = [age ? `від ідеї ${L.daysWord(age)}` : 'записано сьогодні', doneSteps ? `кроків зроблено: ${doneSteps}` : 'кроків ще немає'];
  return `<div class="idea-focus" data-tone="${k.tone}">
    <p class="if-lead">${icon(k.icon)}${esc(k.lead)}</p>
    <h2 class="if-title">${esc(x.title)}</h2>
    <div class="if-step">
      ${st ? `<p class="if-step-l">Наступний крок</p><p class="if-step-t">${esc(st.t)}</p>`
        : `<form class="if-add" data-submit="ideaAddStep" data-id="${esc(x.id)}" autocomplete="off"><input class="input-plain" name="t" maxlength="160" placeholder="${x.steps.length ? 'Наступний' : 'Перший'} маленький крок — на ${ideas.min} хв" enterkeyhint="done" aria-label="${x.steps.length ? 'Наступний' : 'Перший'} маленький крок"><button type="submit" class="icon-btn" aria-label="Записати крок">${icon('plus')}</button></form>`}
    </div>
    ${todayDone ? `<p class="if-done">${icon('checkCircle')}Сьогодні крок до задуму вже є. Завтра — наступний.</p>` : ''}
    <button type="button" class="btn btn-primary btn-xl btn-block" data-act="ideaFocusOpen" data-id="${esc(x.id)}">${icon('play')}${todayDone ? 'Ще трохи' : 'Почати'} — ${ideas.min} хв</button>
    ${weekDots(ideas, today)}
    <p class="if-meta">${typo(meta.join(', '))}</p>
    <div class="if-acts">
      <button type="button" class="btn btn-glass" data-act="ideaOpen" data-id="${esc(x.id)}" aria-label="Кроки й нотатка">${icon('list')}Кроки</button>
      <button type="button" class="btn btn-glass" data-act="ideaShip" data-id="${esc(x.id)}">${icon('rocket')}Відвантажено</button>
    </div>
  </div>`;
}

function ideaRow(x, today) {
  const k = kindOf(x);
  const age = Math.max(0, L.diffDays(L.todayKey(x.createdAt), today));
  const meta = x.doneAt
    ? `відвантажено ${L.shortDate(L.todayKey(x.doneAt), today)}, від ідеї ${L.daysWord(Math.max(0, L.diffDays(L.todayKey(x.createdAt), L.todayKey(x.doneAt))))}`
    : x.parkedAt ? `відкладено ${L.shortDate(L.todayKey(x.parkedAt), today)}` : age ? `у скриньці ${L.daysWord(age)}` : 'записано сьогодні';
  return `<button type="button" class="row row-btn idea-row" data-tone="${k.tone}" data-act="ideaOpen" data-id="${esc(x.id)}">
    <span class="row-lead idea-ic" aria-hidden="true">${icon(x.doneAt ? 'rocket' : k.icon)}</span>
    <span class="row-main"><span class="row-title">${esc(x.title)}</span><span class="row-meta"><span>${esc(k.name)}</span><span>${typo(meta)}</span></span></span>
    ${icon('chev', 'row-chev')}
  </button>`;
}

function quickAdd(app) {
  const kind = app.ui.ideaKind || 'create';
  return `<form class="quick idea-quick" data-submit="ideaQuick" autocomplete="off">
    <span class="quick-ic" aria-hidden="true">${icon('bulb')}</span>
    <input id="ideaNew" name="title" class="quick-input" type="text" placeholder="Ідея одним рядком" maxlength="200" enterkeyhint="done" aria-label="Нова ідея">
    <button type="submit" class="quick-more" aria-label="Записати ідею">${icon('plus')}</button>
  </form>
  <div class="ideas-kind">${seg('Яка ідея', Object.values(I.IDEA_KINDS).map((k) => ({ id: k.id, name: k.name, icon: k.icon })), kind, 'ideaKind')}</div>`;
}

function render(app) {
  const ideas = app.state.ideas;
  const iv = I.ideaView(ideas);
  const today = app.today;
  const principle = I.principleOf(today);
  const slot = I.ideaSlot(ideas);
  const shipped = iv.shipped.slice(0, app.ui.ideasAllShipped ? 50 : 3);
  return `<div class="page page-ideas">
    ${photoHead({ title: 'Задуми', sub: esc(principle) })}
    <section class="section" aria-label="Головний задум">${focusCard(app, iv)}</section>
    <section class="section" aria-labelledby="ibH">
      <div class="sec-row"><h2 class="sec-h" id="ibH">Скринька ідей${iv.inbox.length ? `<span class="sec-count">${iv.inbox.length}</span>` : ''}</h2></div>
      <p class="sec-note">Що спало на думку — одним рядком. Працюєте над однією, решта чекає своєї черги.</p>
      ${quickAdd(app)}
      ${iv.inbox.length ? `<div class="list" style="margin-top:12px">${iv.inbox.map((x) => ideaRow(x, today)).join('')}</div>` : ''}
    </section>
    ${iv.shipped.length ? `<section class="section" aria-labelledby="shH">
      <div class="sec-row"><h2 class="sec-h" id="shH">${icon('rocket', 'sec-ic')}Відвантажено<span class="sec-count">${iv.shipped.length}</span></h2></div>
      <div class="list">${shipped.map((x) => ideaRow(x, today)).join('')}</div>
      ${iv.shipped.length > 3 ? `<button type="button" class="more-btn" data-act="ideasMore" aria-expanded="${!!app.ui.ideasAllShipped}">${app.ui.ideasAllShipped ? 'Згорнути' : `Ще ${iv.shipped.length - 3}`}${icon('down')}</button>` : ''}
    </section>` : ''}
    ${iv.parked.length ? `<section class="section" aria-labelledby="pkH">
      <div class="sec-row"><h2 class="sec-h" id="pkH">Відкладені<span class="sec-count">${iv.parked.length}</span></h2></div>
      <div class="list">${iv.parked.map((x) => ideaRow(x, today)).join('')}</div>
    </section>` : ''}
    <section class="section" aria-label="Час для задуму">
      <div class="list"><button type="button" class="row row-btn" data-act="ideaSlotOpen">
        <span class="row-lead" aria-hidden="true">${icon('clock')}</span>
        <span class="row-main"><span class="row-title">Час для задуму</span><span class="row-meta"><span>${slot.on ? typo(`щодня о ${ideas.at}, ${ideas.min} хв — у «Зараз найважливіше»`) : 'без нагадування'}</span></span></span>
        ${icon('chev', 'row-chev')}
      </button></div>
    </section>
    <details class="how ideas-how">
      <summary>Як це працює${icon('down')}</summary>
      <ul>
        <li><b>Записуйте все</b> — у скриньку, з будь-якого місця: «+» → «Ідея» або ввечері в підсумку дня.</li>
        <li><b>Працюйте над одним</b> — головний задум один. Інші чекають, і це нормально.</li>
        <li><b>Щодня маленький крок</b> — ${ideas.min} хвилин у свій час. Великі речі складаються з малих.</li>
        <li><b>Відвантажуйте</b> — готове краще за ідеальне. Перша версія, перша гривня, перший відгук.</li>
      </ul>
      <p>Лише ваші позначки: записані ідеї, зроблені кроки, дні роботи. Дані — тільки на цьому пристрої.</p>
    </details>
  </div>`;
}

/* ---------- Ідея: кроки, нотатка, рішення ---------- */

function stepRow(s) {
  return `<div class="row sc-step idea-step${s.doneAt ? ' is-done' : ''}" data-id="${esc(s.id)}" data-done="${s.doneAt || 0}">
    <button type="button" class="drag" aria-label="Перемістити крок: натисніть і тягніть, або стрілки вгору й вниз">${icon('grip')}</button>
    <textarea class="input-plain step-t" rows="1" maxlength="160" placeholder="Крок" enterkeyhint="next" aria-label="${s.doneAt ? 'Крок, зроблено' : 'Крок'}">${esc(s.t)}</textarea>
    ${s.doneAt ? `<span class="idea-step-ok" aria-label="Зроблено">${icon('check')}</span>` : ''}
    <button type="button" class="icon-btn" data-act="ideaDelStep" aria-label="Видалити крок">${icon('x')}</button>
  </div>`;
}

function openIdea(app, el) {
  const x = find(app, el.dataset.id);
  if (!x) return;
  const iv = I.ideaView(app.state.ideas);
  const isFocus = iv.focus === x;
  openSheet(`<form class="sheet-form" data-submit="ideaSave" data-id="${esc(x.id)}" autocomplete="off">
    ${sheetHead(x.doneAt ? 'Відвантажено' : isFocus ? 'Головний задум' : 'Ідея', { cancel: 'Скасувати', done: 'Зберегти', submit: true })}
    <div class="list"><label class="row field"><input class="input-plain" name="title" value="${esc(x.title)}" maxlength="200" aria-label="Назва ідеї"></label></div>
    <div style="margin-top:12px">${seg('Яка ідея', Object.values(I.IDEA_KINDS).map((k) => ({ id: k.id, name: k.name, icon: k.icon })), x.kind, 'formSeg', 'kind')}</div>
    <input type="hidden" name="kind" value="${esc(x.kind)}">
    <h3 class="sub-h">Кроки</h3>
    <p class="hint sc-hint">Маленькі, на ${app.state.ideas.min} хв кожен. Порядок — перетягніть за&nbsp;<span class="nw">${icon('grip')}.</span></p>
    <div class="list sc-steps idea-steps">${x.steps.map(stepRow).join('')}</div>
    <button type="button" class="row row-add" style="margin-top:6px" data-act="ideaNewStep">${icon('plus')}<span>Додати крок</span></button>
    <h3 class="sub-h">Нотатка</h3>
    <textarea class="textarea" name="note" rows="3" maxlength="2000" placeholder="Для кого це, що вже є, перша версія — якою вона буде?">${esc(x.note)}</textarea>
    <div class="stack">
      ${!x.doneAt && !isFocus ? `<button type="button" class="btn btn-tinted btn-block" data-act="ideaMakeFocus" data-id="${esc(x.id)}">${icon('spark')}Зробити головним задумом</button>` : ''}
      ${!x.doneAt ? `<button type="button" class="btn btn-quiet btn-block" data-act="ideaShip" data-id="${esc(x.id)}">${icon('rocket')}Відвантажено — готово</button>` : `<button type="button" class="btn btn-quiet btn-block" data-act="ideaReopen" data-id="${esc(x.id)}">${icon('undo')}Повернути в роботу</button>`}
      ${!x.doneAt && !x.parkedAt ? `<button type="button" class="btn btn-quiet btn-block" data-act="ideaPark" data-id="${esc(x.id)}">${icon('archive')}Відкласти ідею</button>` : ''}
      ${x.parkedAt && !x.doneAt ? `<button type="button" class="btn btn-quiet btn-block" data-act="ideaReopen" data-id="${esc(x.id)}">${icon('undo')}Повернути в скриньку</button>` : ''}
      <button type="button" class="btn btn-danger-plain btn-block" data-act="ideaDelete" data-id="${esc(x.id)}">${icon('trash')}Видалити</button>
    </div>
  </form>`, { label: 'Ідея' });
  sortable($('#sheet .idea-steps'), { item: '.idea-step', handle: '.drag' });
  growSteps($('#sheet'));
}

function saveIdea(app, form) {
  const x = find(app, form.dataset.id);
  if (!x) { closeSheet(); return; }
  const title = form.elements.title.value.trim().slice(0, 200);
  if (!title) { form.elements.title.focus(); return; }
  const steps = [...form.querySelectorAll('.idea-step')].map((row) => {
    const t = row.querySelector('.step-t').value.replace(/\s+/g, ' ').trim().slice(0, 160);
    const old = x.steps.find((s) => s.id === row.dataset.id);
    return t ? { id: old ? old.id : L.uid(), t, doneAt: old ? old.doneAt : 0, at: old ? old.at : Date.now() } : null;
  }).filter(Boolean);
  app.commit(() => {
    x.title = title;
    x.kind = I.IDEA_KINDS[form.elements.kind.value] ? form.elements.kind.value : x.kind;
    x.note = form.elements.note.value.trim().slice(0, 2000);
    x.steps = steps;
  });
  closeSheet();
  toast('Збережено', null, 1600, 'check');
}

/* ---------- Робота над задумом: 25 хвилин, крок, «попрацював» ---------- */

let focusIdeaId = '';
function focusHtml(app) {
  const ideas = app.state.ideas;
  const x = find(app, focusIdeaId);
  const head = '<header class="scr-head"><button type="button" class="link" data-act="ideaFocusClose">Вийти</button><span class="scr-head-t">Задум</span><span></span></header>';
  if (!x || x.doneAt) {
    return `<div class="scr focus-scr">${head}<div class="focus-body"><span class="big-check">${icon('check')}</span><h1 class="focus-title">Готово</h1></div>
      <div class="focus-actions"><button type="button" class="btn btn-primary btn-xl btn-block" data-act="ideaFocusClose" data-focus>Повернутися</button></div></div>`;
  }
  const k = kindOf(x);
  const st = I.nextStep(x);
  const tm = I.ideaTimer(ideas);
  const mine = tm && tm.id === x.id;
  const timer = mine
    ? tm.over
      ? `<div class="focus-timer is-over" role="status"><p class="ft-big">Час вийшов</p><p class="ft-sub">${tm.mins} хв роботи над задумом</p>
          <div class="row2"><button type="button" class="btn btn-glass" data-act="ideaTimer" data-v="5">${icon('timer')}Ще 5 хв</button><button type="button" class="btn btn-glass" data-act="ideaTimer" data-v="0">Зупинити</button></div></div>`
      : `<div class="focus-timer" role="timer" aria-label="Таймер"><p class="ft-big tnum" data-count-to="${tm.end}" data-fin="1">${L.fmtClock(tm.left)}</p><p class="ft-sub">з ${tm.mins} хв</p>
          <button type="button" class="btn btn-glass btn-sm" data-act="ideaTimer" data-v="0">Зупинити таймер</button></div>`
    : `<div class="focus-timer is-off"><p class="ft-sub">Таймер</p><div class="chips center-chips">${I.SLOT_MINS.map((m) => `<button type="button" class="chip plain${m === ideas.min ? ' on' : ''}" data-act="ideaTimer" data-v="${m}">${icon('timer')}${m} хв</button>`).join('')}</div></div>`;
  const todayDone = I.stepToday(ideas);
  return `<div class="scr focus-scr idea-scr" data-tone="${k.tone}" data-id="${esc(x.id)}">${head}
    <div class="focus-body">
      <p class="focus-kind">${icon(k.icon)}${esc(k.lead)}</p>
      <h1 class="focus-title">${esc(x.title)}</h1>
      ${st ? `<div class="focus-next"><p class="focus-next-l">Крок на зараз</p><p class="focus-next-t">${esc(st.t)}</p></div>`
        : `<form class="focus-next if-add" data-submit="ideaAddStep" data-id="${esc(x.id)}" autocomplete="off"><p class="focus-next-l">${x.steps.length ? 'Який наступний маленький крок?' : 'Який перший маленький крок?'}</p><div class="if-add-row"><input class="input-plain" name="t" maxlength="160" placeholder="${x.steps.length ? 'Наприклад: показати одному знайомому' : 'Наприклад: накидати три назви'}" enterkeyhint="done" aria-label="${x.steps.length ? 'Наступний крок' : 'Перший крок'}"><button type="submit" class="icon-btn" aria-label="Записати крок">${icon('plus')}</button></div></form>`}
      ${timer}
      ${todayDone ? `<p class="focus-reason">${icon('checkCircle')}Сьогодні крок уже зараховано</p>` : ''}
    </div>
    <div class="focus-actions">
      ${st ? `<button type="button" class="btn btn-primary btn-xl btn-block" data-act="ideaStep" data-id="${esc(x.id)}" data-step="${esc(st.id)}" data-focus>${icon('check')}Крок зроблено</button>` : ''}
      ${todayDone
        ? `<button type="button" class="btn ${st ? 'btn-glass' : 'btn-primary btn-xl'} btn-block" data-act="ideaFocusClose">${icon('moon')}Завершити на сьогодні</button>`
        : `<button type="button" class="btn ${st ? 'btn-glass' : 'btn-primary btn-xl'} btn-block" data-act="ideaWorked" data-id="${esc(x.id)}">${icon('spark')}Попрацював — зарахувати день</button>`}
    </div>
  </div>`;
}

export function openIdeaFocus(app, id, from = null) {
  focusIdeaId = id;
  if ($('#sheet').open) closeSheet();
  document.documentElement.classList.add('focus-mode');
  openScreen(focusHtml(app), {
    label: 'Робота над задумом', from, bg: 'abstract-02.webp', bgPos: '40% center', cls: 'focus',
    onClose: () => { document.documentElement.classList.remove('focus-mode'); app.screenTick = null; app.render(); },
  });
  app.screenTick = () => {
    const tm = I.ideaTimer(app.state.ideas);
    if (tm?.over) haptic();
    updateScreen(focusHtml(app));
  };
}

// Відвантажено: момент результату — скільки днів від ідеї й скільки кроків. Справжні числа.
function shipHtml(x, res, iv) {
  return `<div class="scr ship-scr">
    <header class="scr-head"><span></span><span class="scr-head-t">Задум</span><span></span></header>
    <div class="ship-body">
      <span class="ship-ic" aria-hidden="true">${icon('rocket')}</span>
      <h1 class="ship-t">Відвантажено</h1>
      <p class="ship-name">${esc(x.title)}</p>
      <p class="ship-facts">${typo(`Від ідеї до результату — ${res.days ? L.daysWord(res.days) : 'менше доби'}. Кроків зроблено: ${res.steps}.`)}</p>
      <p class="ship-note">Готове краще за ідеальне. Покажіть — і подумайте, що далі.</p>
    </div>
    <div class="focus-actions">
      ${iv.inbox.length ? `<button type="button" class="btn btn-primary btn-xl btn-block" data-act="ideaPickNext" data-focus>${icon('spark')}Обрати наступний задум</button>` : ''}
      <button type="button" class="btn ${iv.inbox.length ? 'btn-glass' : 'btn-primary btn-xl'} btn-block" data-act="ideaFocusClose">Готово</button>
    </div>
  </div>`;
}

const actions = {
  ideaQuick(app, form) {
    const title = form.elements.title.value.trim();
    if (!title) return;
    let x = null;
    app.commit((s) => { x = I.addIdea(s.ideas, title, app.ui.ideaKind || 'create', Date.now()); });
    if (!x) { toast('Скринька повна: відвантажте або видаліть старі ідеї'); return; }
    haptic();
    toast(app.state.ideas.focus === x.id ? 'Записано — це ваш головний задум' : 'Ідею записано', { label: 'Скасувати', run: () => app.commit((s) => { s.ideas.list = s.ideas.list.filter((y) => y.id !== x.id); if (s.ideas.focus === x.id) s.ideas.focus = ''; }) });
    requestAnimationFrame(() => document.getElementById('ideaNew')?.focus({ preventScroll: true }));
  },
  ideaKind(app, el) {
    app.ui.ideaKind = el.dataset.v;
    el.closest('.seg').querySelectorAll('[role="radio"]').forEach((b) => b.setAttribute('aria-checked', String(b === el)));
  },
  ideasMore(app) { app.ui.ideasAllShipped = !app.ui.ideasAllShipped; app.render(); },
  ideaOpen: openIdea,
  ideaSave: saveIdea,
  ideaNewStep(app, el) {
    const list = el.closest('form').querySelector('.idea-steps');
    list.insertAdjacentHTML('beforeend', stepRow({ id: '', t: '', doneAt: 0 }));
    list.lastElementChild.querySelector('.step-t').focus();
  },
  ideaDelStep(app, el) { el.closest('.idea-step').remove(); },
  ideaAddStep(app, form) {
    const x = find(app, form.dataset.id);
    const t = form.elements.t.value.trim();
    if (!x || !t) return;
    app.commit(() => { I.addStep(x, t); }, { render: !screenOpen() });
    if (screenOpen()) updateScreen(focusHtml(app));
    haptic();
  },
  ideaMakeFocus(app, el) {
    const x = find(app, el.dataset.id);
    if (!x) return;
    app.commit((s) => { I.setFocus(s.ideas, x.id); });
    if ($('#sheet').open) closeSheet();
    if (screenOpen()) closeScreen();
    haptic();
    toast(`Головний задум: ${x.title}`, null, 2200, 'spark');
  },
  ideaFocusOpen(app, el) { openIdeaFocus(app, el.dataset.id, el); },
  ideaFocusClose() { closeScreen(); },
  ideaTimer(app, el) {
    const mins = +el.dataset.v;
    app.commit((s) => { s.ideas.timer = mins ? { id: focusIdeaId, start: Date.now(), mins } : null; }, { render: false });
    updateScreen(focusHtml(app));
  },
  ideaStep(app, el) {
    const x = find(app, el.dataset.id);
    if (!x) return;
    let day = '';
    app.commit((s) => { const st = I.doneStep(s.ideas, x.id, el.dataset.step, Date.now()); if (st) day = L.todayKey(st.doneAt); s.ideas.timer = null; }, { render: false });
    haptic();
    updateScreen(focusHtml(app));
    const st = x.steps.find((y) => y.id === el.dataset.step);
    toast('Крок зроблено. Так і складається велике', { label: 'Скасувати', run: () => { app.commit((s) => { if (st) st.doneAt = 0; I.unlogDay(s.ideas, day); }, { render: false }); updateScreen(focusHtml(app)); } }, 0, 'check');
  },
  ideaWorked(app) {
    let day = '';
    app.commit((s) => { day = I.logDay(s.ideas, Date.now()); s.ideas.timer = null; }, { render: false });
    haptic();
    updateScreen(focusHtml(app));
    toast('День зараховано', { label: 'Скасувати', run: () => { app.commit((s) => I.unlogDay(s.ideas, day), { render: false }); updateScreen(focusHtml(app)); } }, 0, 'check');
  },
  async ideaShip(app, el) {
    const x = find(app, el.dataset.id);
    if (!x) return;
    if ($('#sheet').open) closeSheet();
    await new Promise((r) => setTimeout(r, 230));
    const ok = await confirmSheet({ title: 'Відвантажено?', text: `«${x.title}» готово — перша версія, перший результат чи перша гривня. Задум переїде в «Відвантажено».`, ok: 'Так, готово' });
    if (!ok) return;
    let res = null;
    app.commit((s) => { res = I.shipIdea(s.ideas, x.id, Date.now()); s.ideas.timer = null; }, { render: false });
    if (!res) return;
    haptic();
    const iv = I.ideaView(app.state.ideas);
    if (screenOpen()) closeScreen();
    await new Promise((r) => setTimeout(r, 260));
    openScreen(shipHtml(x, res, iv), { label: 'Відвантажено', bg: 'abstract-02.webp', bgPos: '76% center', cls: 'ship', onClose: () => app.render() });
  },
  ideaPickNext(app) {
    closeScreen();
    setTimeout(() => { app.go('ideas'); document.querySelector('#ibH')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 300);
  },
  ideaPark(app, el) {
    const x = find(app, el.dataset.id);
    if (!x) return;
    app.commit((s) => I.parkIdea(s.ideas, x.id, Date.now()));
    closeSheet();
    toast('Ідею відкладено', { label: 'Скасувати', run: () => app.commit((s) => { I.reopenIdea(s.ideas, x.id); }) });
  },
  ideaReopen(app, el) {
    const x = find(app, el.dataset.id);
    if (!x) return;
    app.commit((s) => I.reopenIdea(s.ideas, x.id));
    closeSheet();
    toast('Ідея знову в скриньці', null, 1800, 'check');
  },
  async ideaDelete(app, el) {
    const x = find(app, el.dataset.id);
    if (!x) return;
    const ok = await confirmSheet({ title: 'Видалити ідею?', text: 'Разом із кроками й нотаткою. Щоб лише прибрати зі скриньки, оберіть «Відкласти».', ok: 'Видалити', danger: true });
    if (!ok) return;
    const was = app.state.ideas.focus === x.id;
    app.commit((s) => { s.ideas.list = s.ideas.list.filter((y) => y.id !== x.id); if (was) s.ideas.focus = ''; });
    toast('Ідею видалено', { label: 'Скасувати', run: () => app.commit((s) => { s.ideas.list.push(x); if (was) s.ideas.focus = x.id; }) });
  },
  ideaSlotOpen(app) {
    const ideas = app.state.ideas;
    openSheet(`<form class="sheet-form" data-submit="ideaSlotSave" autocomplete="off">
      ${sheetHead('Час для задуму', { cancel: 'Скасувати', done: 'Готово', submit: true })}
      <p class="sheet-text">Щодня в цей час — крок до головного задуму в «Зараз найважливіше». Не зранку й не замість важливого.</p>
      <div class="list">
        <label class="row field-row"><span class="row-main"><span class="row-title">Нагадувати</span></span><input type="checkbox" class="switch" name="on"${ideas.at ? ' checked' : ''}></label>
        <label class="row field-row"><span class="row-main"><span class="row-title">О котрій</span></span><input class="time-input" type="time" name="at" value="${esc(ideas.at || '20:00')}"></label>
      </div>
      <h3 class="sub-h">Скільки хвилин</h3>
      ${seg('Скільки хвилин', I.SLOT_MINS.map((m) => ({ id: m, name: `${m} хв` })), ideas.min, 'formSeg', 'min')}
      <input type="hidden" name="min" value="${ideas.min}">
    </form>`, { label: 'Час для задуму' });
  },
  ideaSlotSave(app, form) {
    const f = form.elements;
    const at = L.parseHM(f.at.value);
    app.commit((s) => {
      s.ideas.at = f.on.checked && at != null ? L.fmtHM(at) : '';
      s.ideas.min = I.SLOT_MINS.includes(+f.min.value) ? +f.min.value : 25;
    });
    closeSheet();
    toast(app.state.ideas.at ? `Щодня о ${app.state.ideas.at}, ${app.state.ideas.min} хв` : 'Без нагадування', null, 2000, 'check');
  },
};

const backdrop = () => ({ src: 'abstract-02.webp', kind: 'band', pos: 'center 45%' });

export default { title: 'Задуми', render, backdrop, actions };
