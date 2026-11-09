// ОПОРА 365 — «Швидка дія»: Command Deck. Сценарій за один-два дотики, памʼять дій (останні й обрані),
// несподіване доручення одразу в справи. Лише організаційні чеклісти: без тактичних рекомендацій
// і без збирання оперативних відомостей.
import * as L from './logic.js';
import * as D from './logic-deck.js';
import { $, esc, icon, seg, openSheet, closeSheet, confirmSheet, choiceSheet, toast, sheetHead, haptic, openScreen, updateScreen, closeScreen, setScreenBg, sortable, growSteps } from './ui.js';
import { quickTile, checklistItem, miniRing, emptyState, animateRings, photoHead } from './components.js';
import { addTask } from './view-tasks.js';

const scOf = (app, id) => app.state.deck.scenarios.find((s) => s.id === id) || null;

function memoryRow(app, { sc, run }) {
  const k = D.KIND[sc.kind];
  const t = L.kyivParts(run.finishedAt);
  const res = sc.kind === 'task' ? esc(run.title.replace(/^Доручення: /, '')) : run.result === 'done' ? `Готово, ${run.doneCount} з ${run.total}` : `Частково: не підтверджено ${run.reqTotal - run.reqDone}`;
  return `<button type="button" class="row row-btn mem-row" data-tone="${k.tone}" data-act="deckOpen" data-kind="${sc.kind}" data-id="${esc(sc.id)}">
    <span class="row-ic">${icon(k.icon)}</span>
    <span class="row-main"><span class="row-title">${esc(sc.kind === 'task' ? 'Нове доручення' : sc.title)}</span><span class="row-meta"><span>${L.shortDate(t.date, L.todayKey())}, ${L.fmtHM(t.min)}</span><span>${res}</span></span></span>
    ${icon('play', 'row-go')}
  </button>`;
}

function render(app) {
  const deck = app.state.deck;
  const run = deck.active;
  const runSc = run ? scOf(app, run.sid) : null;
  const pr = run ? D.runProgress(run, runSc) : null;
  const tiles = ['med', 'tac', 'fire', 'go', 'task'].map((k) => {
    const sc = deck.scenarios.find((s) => s.kind === k);
    return quickTile({ kind: D.KIND[k], sc, run: run && sc && run.sid === sc.id ? run : null, fav: sc && deck.favs.includes(sc.id) });
  });
  const customs = deck.scenarios.filter((s) => s.kind === 'custom');
  tiles.push(quickTile({ kind: D.KIND.custom, sc: null, run: run && runSc?.kind === 'custom' ? run : null, count: customs.length }));
  const favs = deck.favs.map((id) => scOf(app, id)).filter(Boolean);
  const recent = D.recentScenarios(deck, 4);
  return `<div class="page">
    ${photoHead({ title: 'Швидка дія', sub: 'Плани змінилися — потрібний сценарій за один-два дотики' })}
    ${run && runSc ? `<button type="button" class="run-banner" data-act="dkResume">${miniRing({ key: 'deck-banner', value: pr.done, total: pr.total, dim: 44, tone: 'blue' })}<span class="rb-main"><b>Триває: ${esc(run.title)}</b><span>Виконано ${pr.done} з ${pr.total}, обовʼязкових ${pr.reqDone} з ${pr.reqTotal}</span></span>${icon('chev', 'row-chev')}</button>` : ''}
    ${favs.length ? `<section class="section" aria-labelledby="favH">
      <div class="sec-row"><h2 class="sec-h" id="favH">${icon('star', 'sec-ic')}Обране</h2></div>
      <div class="fav-row">${favs.map((sc) => `<button type="button" class="fav-btn" data-tone="${D.KIND[sc.kind].tone}" data-act="deckOpen" data-kind="${sc.kind}" data-id="${esc(sc.id)}">${icon(D.KIND[sc.kind].icon)}<span>${esc(sc.title)}</span></button>`).join('')}</div>
    </section>` : ''}
    <div class="deck-grid">${tiles.join('')}</div>
    ${recent.length ? `<section class="section" aria-labelledby="recH">
      <div class="sec-row"><h2 class="sec-h" id="recH">Останні використані</h2></div>
      <div class="list">${recent.map((x) => memoryRow(app, x)).join('')}</div>
    </section>` : ''}
    <button type="button" class="row row-btn tools-row" data-act="tab" data-tab="tools">
      <img class="tools-row-bg" src="abstract-07.webp" alt="" loading="lazy" decoding="async"><span class="tools-row-shade" aria-hidden="true"></span>
      <span class="row-ic">${icon('apps')}</span>
      <span class="row-main"><span class="row-title">Інструменти</span><span class="row-meta">Ваші сайти й застосунки одним дотиком: ${app.state.tools.length}</span></span>
      ${icon('chev', 'row-chev')}
    </button>
    <p class="foot">Сценарії допомагають організувати навчальні заняття й особисті збори. Склад кожного можна змінити (${icon('edit')} у чеклісті), а зірочкою — додати в «Обране».</p>
  </div>`;
}

// Ілюстрація — уся, праворуч, під панеллю навігації: плитки не ховаються під «островом» і кнопками.
const backdrop = () => ({ src: 'quick-action-visual.webp', kind: 'stage', art: 'whole', ar: '1 / 1', ah: '86%', pos: '50% 50%', h: '292px' });

/* ---------- Екран сценарію ---------- */

function runHtml(app) {
  const run = app.state.deck.active;
  const sc = run ? scOf(app, run.sid) : null;
  if (!run || !sc) return '';
  const k = D.KIND[sc.kind];
  const pr = D.runProgress(run, sc);
  const fav = app.state.deck.favs.includes(sc.id);
  const steps = sc.steps.map((s) => checklistItem({ id: s.id, text: s.t, on: !!run.checked[s.id], act: 'dkStep', req: s.req })).join('');
  return `<div class="scr" data-tone="${k.tone}">
    <header class="scr-head">
      <button type="button" class="link" data-act="dkClose">Згорнути</button>
      <span class="scr-head-t">Сценарій</span>
      <span class="scr-head-acts">
        <button type="button" class="icon-btn${fav ? ' on' : ''}" data-act="dkFav" data-id="${esc(sc.id)}" aria-pressed="${fav}" aria-label="${fav ? 'Прибрати з обраного' : 'Додати в обране'}">${icon('star', fav ? 'fill' : '')}</button>
        <button type="button" class="icon-btn" data-act="dkEdit" data-id="${esc(sc.id)}" aria-label="Змінити кроки сценарію">${icon('edit')}</button>
      </span>
    </header>
    <div class="scr-hero">
      <div class="scr-ic">${icon(k.icon)}</div>
      <h1 class="scr-title">${esc(sc.title)}</h1>
      <p class="scr-sub">${esc(k.desc)}</p>
      <div class="scr-prog" aria-live="polite">
        ${miniRing({ key: `run-${run.id}`, value: pr.done, total: pr.total, dim: 52 })}
        <div><b>${pr.done}/${pr.total}</b><span>кроків</span></div>
        <div><b>${pr.reqDone}/${pr.reqTotal}</b><span>обовʼязкових</span></div>
      </div>
    </div>
    ${sc.steps.length ? `<div class="cl" role="group" aria-label="Кроки">${steps}</div>` : emptyState({ ic: 'list', title: 'У сценарії немає кроків', text: 'Додайте кроки кнопкою редагування вгорі.' })}
    <h3 class="sub-h">Нотатка</h3>
    <textarea class="textarea" id="dkNote" rows="3" maxlength="2000" data-change="dkNote" placeholder="Необовʼязково">${esc(run.note)}</textarea>
    <div class="scr-foot">
      <button type="button" class="btn ${pr.complete ? 'btn-primary' : 'btn-tinted'} btn-xl btn-block" data-act="dkFinish">${icon('check')}${pr.complete ? 'Завершити: усе підтверджено' : 'Завершити'}</button>
      <p class="hint">${pr.complete ? 'Усі обовʼязкові кроки підтверджено.' : `Не підтверджено обовʼязкових: ${pr.reqTotal - pr.reqDone}. Без них результат буде «Частково».`}</p>
    </div>
  </div>`;
}

function resultHtml(app, r) {
  const sc = scOf(app, r.sid);
  const mins = Math.max(1, Math.round((r.finishedAt - r.startedAt) / 60000));
  const done = r.result === 'done';
  return `<div class="scr">
    <header class="scr-head"><span></span><span class="scr-head-t">Результат</span><button type="button" class="link strong" data-act="dkClose">Готово</button></header>
    <div class="result-card" data-r="${r.result}">
      <span class="big-check${done ? '' : ' partial'}">${icon(done ? 'check' : 'alert')}</span>
      <h2>${done ? 'Готово' : 'Завершено частково'}</h2>
      <p>${esc(r.title)}: ${r.doneCount} з ${r.total} кроків, ${L.fmtDur(mins)}</p>
      ${done ? '' : `<ul>${r.missing.map((m) => `<li>${icon('alert')}<span>Не підтверджено: ${esc(m)}</span></li>`).join('')}</ul>`}
      ${!done && sc ? `<button type="button" class="btn btn-tinted btn-block" data-act="dkRestart" data-id="${esc(sc.id)}">${icon('reset')}Почати знову</button>` : ''}
      <button type="button" class="btn btn-quiet btn-block" data-act="dkClose">Закрити</button>
    </div>
  </div>`;
}

function show(app, from) {
  openScreen(runHtml(app), {
    label: 'Сценарій',
    from,
    onClose: () => {
      // Відкритий і закритий без жодної позначки сценарій не засмічує історію.
      const run = app.state.deck.active;
      if (run && !Object.keys(run.checked).length && !run.note) app.commit((s) => { s.deck.active = null; }, { render: false });
      app.render();
    },
  });
  animateRings($('#screen'));
}

export function openRunScreen(app, from = null) {
  if (!app.state.deck.active) return;
  show(app, from);
}

async function startScenario(app, sc, from) {
  const cur = app.state.deck.active;
  if (cur && cur.sid !== sc.id && Object.keys(cur.checked).length) {
    const v = await choiceSheet({
      title: `Триває «${cur.title}»`,
      text: 'Одночасно може виконуватися один сценарій.',
      options: [
        { id: 'resume', label: `Продовжити «${cur.title}»`, icon: 'play' },
        { id: 'switch', label: `Почати «${sc.title}»`, icon: 'arrow', hint: 'Поточний буде збережено як частковий' },
      ],
    });
    if (!v) return;
    if (v === 'resume') { show(app, from); return; }
    const curSc = scOf(app, cur.sid);
    app.commit((s) => D.finishRun(s.deck, curSc, Date.now()), { render: false });
  }
  if (!app.state.deck.active || app.state.deck.active.sid !== sc.id) {
    app.commit((s) => D.startRun(s.deck, sc, Date.now()), { render: false });
  }
  haptic();
  show(app, from);
}

/* ---------- Несподіване доручення: швидка форма ---------- */

function assignHtml(app) {
  const today = app.today;
  const tom = L.addDays(today, 1);
  return `<div class="scr assign-scr" data-tone="moon">
    <header class="scr-head"><button type="button" class="link" data-act="dkClose">Закрити</button><span class="scr-head-t">Доручення</span><span></span></header>
    <form class="assign" data-submit="asSave" autocomplete="off">
      <div class="scr-hero"><div class="scr-ic">${icon('clipboard')}</div><h1 class="scr-title">Що потрібно зробити?</h1></div>
      <div class="list"><label class="row field"><textarea class="input-plain as-what" name="what" rows="2" maxlength="300" placeholder="Суть доручення" aria-label="Що зробити" data-focus></textarea></label></div>
      <p class="hint">Особисту організацію записуйте без оперативних відомостей.</p>
      <h3 class="sub-h">До якого часу</h3>
      <div class="due">
        <button type="button" class="chip plain" data-act="setDue" data-v="${today}" aria-pressed="true">Сьогодні</button>
        <button type="button" class="chip plain" data-act="setDue" data-v="${tom}" aria-pressed="false">Завтра</button>
        <input class="date-input" type="date" name="due" value="${today}" data-change="dueInput" aria-label="Дата">
        <input class="time-input" type="time" name="time" aria-label="Час">
      </div>
      <p class="hint">Дата й час стануть дедлайном.</p>
      <h3 class="sub-h">Пріоритет</h3>
      ${seg('Пріоритет', L.PRIORITIES.map((p) => ({ id: p.id, name: p.short })), 1, 'formSeg', 'pr')}
      <input type="hidden" name="pr" value="1">
      <h3 class="sub-h">Що необхідно</h3>
      <textarea class="textarea" name="needs" rows="3" maxlength="1500" placeholder="Документи, люди, транспорт… Кожен пункт — з нового рядка, стане кроком справи"></textarea>
      <div class="scr-foot"><button type="submit" class="btn btn-primary btn-xl btn-block">${icon('plus')}Додати в справи</button></div>
    </form>
  </div>`;
}

function openAssign(app, from) {
  openScreen(assignHtml(app), { label: 'Несподіване доручення', from, bg: 'abstract-06.webp', bgPos: 'center 30%', cls: 'soft-bg' });
}

/* ---------- Редактор сценарію ---------- */

function stepRowEd(s) {
  // Ручка ліворуч — подалі від «×», щоб, тягнучи, не видалити крок випадково.
  return `<div class="row sc-step" data-id="${esc(s.id || '')}">
    <button type="button" class="drag" aria-label="Перемістити крок: натисніть і тягніть, або стрілки вгору й вниз">${icon('grip')}</button>
    <textarea class="input-plain step-t" rows="1" placeholder="Крок" maxlength="120" enterkeyhint="next" aria-label="Текст кроку">${esc(s.t)}</textarea>
    <button type="button" class="icon-btn${s.req ? ' on' : ''}" aria-pressed="${!!s.req}" data-act="scReq" aria-label="Обовʼязковий крок">${icon('shield')}</button>
    <button type="button" class="icon-btn" data-act="scDel" aria-label="Видалити крок">${icon('x')}</button>
  </div>`;
}

function openEditor(app, sc) {
  const isNew = !sc;
  const s = sc || { id: 'new', kind: 'custom', title: '', steps: [] };
  openSheet(`<form class="sheet-form" data-submit="scSave" data-id="${esc(s.id)}" autocomplete="off">
    ${sheetHead(isNew ? 'Новий сценарій' : 'Сценарій', { cancel: 'Скасувати', done: 'Зберегти', submit: true })}
    <div class="list"><label class="row field"><input class="input-plain" name="title" value="${esc(s.title)}" placeholder="Назва сценарію" maxlength="60" aria-label="Назва сценарію"${isNew ? ' data-focus' : ''}></label></div>
    <h3 class="sub-h">Кроки, ${icon('shield', 'crit')} — обовʼязкові</h3>
    <p class="hint sc-hint">Порядок — перетягніть за&nbsp;<span class="nw">${icon('grip')} ліворуч.</span></p>
    <div class="list sc-steps">${s.steps.map(stepRowEd).join('')}</div>
    <button type="button" class="row row-add" style="margin-top:6px" data-act="scAdd">${icon('plus')}<span>Додати крок</span></button>
    <p class="hint">Сценарій завершиться як «Готово», лише коли підтверджено всі обовʼязкові кроки.</p>
    <div class="stack">
      ${!isNew && s.kind !== 'custom' ? `<button type="button" class="btn btn-quiet btn-block" data-act="scReset" data-id="${esc(s.id)}">${icon('reset')}Відновити типовий шаблон</button>` : ''}
      ${!isNew && s.kind === 'custom' ? `<button type="button" class="btn btn-danger-plain btn-block" data-act="scDelete" data-id="${esc(s.id)}">${icon('trash')}Видалити сценарій</button>` : ''}
    </div>
  </form>`, { label: 'Сценарій' });
  sortable($('#sheet .sc-steps'), { item: '.sc-step', handle: '.drag' });
  growSteps($('#sheet'));
  if (isNew) $('#sheet [data-act="scAdd"]')?.click();
}

const actions = {
  async deckOpen(app, el) {
    const kind = el.dataset.kind;
    if (kind === 'task') { openAssign(app, el); return; }
    if (kind === 'custom' && !el.dataset.id) {
      const customs = app.state.deck.scenarios.filter((s) => s.kind === 'custom');
      if (!customs.length) { openEditor(app, null); return; }
      const v = await choiceSheet({
        title: 'Власні сценарії',
        options: [...customs.map((c) => ({ id: c.id, label: c.title, icon: 'layers', hint: `${L.count(c.steps.length, ['крок', 'кроки', 'кроків'])}` })), ...(customs.length < D.CUSTOM_MAX ? [{ id: 'new', label: 'Створити новий', icon: 'plus' }] : [])],
      });
      if (!v) return;
      if (v === 'new') { openEditor(app, null); return; }
      const sc = scOf(app, v);
      if (sc) startScenario(app, sc, el);
      return;
    }
    const sc = scOf(app, el.dataset.id);
    if (sc) startScenario(app, sc, el);
  },
  dkResume(app, el) { openRunScreen(app, el); },
  dkClose() { closeScreen(); },
  dkStep(app, el) {
    const run = app.state.deck.active;
    if (!run) return;
    const id = el.dataset.id;
    const on = !run.checked[id];
    app.commit((s) => { if (on) s.deck.active.checked[id] = Date.now(); else delete s.deck.active.checked[id]; }, { render: false });
    if (on) haptic();
    updateScreen(runHtml(app));
    animateRings($('#screen'));
  },
  dkNote(app, el) {
    if (!app.state.deck.active) return;
    app.commit((s) => { s.deck.active.note = el.value.slice(0, 2000); }, { render: false });
  },
  dkFav(app, el) {
    let on = false;
    app.commit((s) => { on = D.toggleFav(s.deck, el.dataset.id); }, { render: false });
    haptic();
    if ($('#screen').open) updateScreen(runHtml(app));
    toast(on ? 'Додано в обране' : 'Прибрано з обраного', null, 1800, on ? 'star' : '');
  },
  async dkFinish(app) {
    const run = app.state.deck.active;
    if (!run) return;
    const note = document.getElementById('dkNote');
    if (note) app.commit((s) => { s.deck.active.note = note.value.slice(0, 2000); }, { render: false });
    const sc = scOf(app, run.sid);
    const pr = D.runProgress(run, sc);
    if (!pr.complete) {
      const ok = await confirmSheet({
        title: 'Завершити частково?',
        text: `Не підтверджено обовʼязкових кроків: ${pr.reqTotal - pr.reqDone}. Результат буде позначено як «Частково», не «Готово».`,
        ok: 'Завершити частково',
        cancel: 'Повернутися до кроків',
      });
      if (!ok) return;
    }
    let r = null;
    app.commit((s) => { r = D.finishRun(s.deck, sc, Date.now()); }, { render: false });
    if (r?.result === 'done') haptic();
    setScreenBg('abstract-05.webp', 'center 30%');
    updateScreen(resultHtml(app, r), { top: 0 });
  },
  dkRestart(app, el) {
    const sc = scOf(app, el.dataset.id);
    if (!sc) return;
    app.commit((s) => D.startRun(s.deck, sc, Date.now()), { render: false });
    setScreenBg('');
    updateScreen(runHtml(app), { top: 0 });
    animateRings($('#screen'));
  },
  asSave(app, form) {
    const f = form.elements;
    const what = f.what.value.trim();
    if (!what) { f.what.focus(); toast('Опишіть, що потрібно зробити'); return; }
    const data = D.assignmentTask({ what, date: f.due.value, time: f.time.value, pr: f.pr.value, needs: f.needs.value }, app.today);
    const t = addTask(app, data.title, data.pr, data.due, data);
    if (!t) return;
    app.commit((s) => D.logAssignment(s.deck, t.title, Date.now()));
    haptic();
    closeScreen();
    toast('Доручення додано в справи', { label: 'Відкрити', run: () => app.go('tasks') }, 0, 'check');
  },
  dkEdit(app, el) {
    const sc = scOf(app, el.dataset.id);
    if (sc) openEditor(app, sc);
  },
  scAdd(app, el) {
    const list = el.closest('form').querySelector('.sc-steps');
    list.insertAdjacentHTML('beforeend', stepRowEd({ id: '', t: '', req: false }));
    list.lastElementChild.querySelector('.step-t').focus();
  },
  scReq(app, el) {
    const on = el.getAttribute('aria-pressed') !== 'true';
    el.setAttribute('aria-pressed', String(on));
    el.classList.toggle('on', on);
  },
  scDel(app, el) { el.closest('.sc-step').remove(); },
  scSave(app, form) {
    const title = form.elements.title.value.trim().slice(0, 60);
    if (!title) { form.elements.title.focus(); return; }
    const steps = [...form.querySelectorAll('.sc-step')].map((row) => ({
      id: row.dataset.id || L.uid(),
      t: row.querySelector('.step-t').value.replace(/\s+/g, ' ').trim().slice(0, 120),
      req: row.querySelector('[data-act="scReq"]').getAttribute('aria-pressed') === 'true',
    })).filter((s) => s.t).slice(0, 40);
    const id = form.dataset.id;
    app.commit((s) => {
      if (id === 'new') s.deck.scenarios.push({ id: L.uid(), kind: 'custom', title, steps });
      else {
        const sc = s.deck.scenarios.find((x) => x.id === id);
        if (sc) { sc.title = title; sc.steps = steps; }
        const run = s.deck.active;
        if (run && run.sid === id) {
          run.title = title;
          for (const k of Object.keys(run.checked)) if (!steps.some((x) => x.id === k)) delete run.checked[k];
        }
      }
    }, { render: false });
    closeSheet();
    if (app.state.deck.active && $('#screen').open) updateScreen(runHtml(app));
    else app.render();
    toast('Сценарій збережено', null, 1800, 'check');
  },
  async scReset(app, el) {
    const sc = scOf(app, el.dataset.id);
    if (!sc) return;
    const ok = await confirmSheet({ title: 'Відновити типовий шаблон?', text: 'Кроки сценарію буде замінено стандартними.', ok: 'Відновити' });
    if (!ok) return;
    app.commit((s) => {
      const x = s.deck.scenarios.find((y) => y.id === sc.id);
      x.steps = D.templateSteps(x.kind);
      x.title = D.KIND[x.kind].name;
      if (s.deck.active?.sid === x.id) { s.deck.active.checked = {}; s.deck.active.title = x.title; }
    }, { render: false });
    if ($('#screen').open) updateScreen(runHtml(app)); else app.render();
  },
  async scDelete(app, el) {
    const sc = scOf(app, el.dataset.id);
    if (!sc) return;
    const ok = await confirmSheet({ title: `Видалити «${sc.title}»?`, text: 'Історія запусків залишиться.', ok: 'Видалити', danger: true });
    if (!ok) return;
    app.commit((s) => {
      s.deck.scenarios = s.deck.scenarios.filter((x) => x.id !== sc.id);
      s.deck.favs = s.deck.favs.filter((x) => x !== sc.id);
      if (s.deck.active?.sid === sc.id) s.deck.active = null;
    }, { render: false });
    if ($('#screen').open) closeScreen(); else app.render();
  },
};

export default { title: 'Швидка дія', render, backdrop, actions };
