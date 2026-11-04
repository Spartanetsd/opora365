// ОПОРА 365 — «Швидко»: Command Deck. Великі плитки сценаріїв, чекліст за один дотик.
// «Готово» зʼявляється лише після підтвердження всіх обовʼязкових кроків.
// Це інтерфейс організації особистих справ і навчальних занять — без тактичних рекомендацій.
import * as L from './logic.js';
import * as D from './logic-deck.js';
import { $, esc, icon, openSheet, closeSheet, confirmSheet, choiceSheet, toast, sheetHead, haptic, openScreen, updateScreen, closeScreen } from './ui.js';
import { quickTile, checklistItem, miniRing, emptyState, animateRings } from './components.js';
import { addTask } from './view-tasks.js';

export function switcher(active) {
  return `<div class="seg" role="radiogroup" aria-label="Розділ" style="margin-bottom:6px">
    <button type="button" role="radio" aria-checked="${active === 'deck'}" data-act="tab" data-tab="deck"><span>Сценарії</span></button>
    <button type="button" role="radio" aria-checked="${active === 'tools'}" data-act="tab" data-tab="tools"><span>Інструменти</span></button>
  </div>`;
}

const scOf = (app, id) => app.state.deck.scenarios.find((s) => s.id === id) || null;

function runRow(r) {
  const t = L.kyivParts(r.finishedAt);
  const res = r.result === 'done' ? `Готово · ${r.doneCount}/${r.total}` : `Частково · не підтверджено обовʼязкових: ${r.reqTotal - r.reqDone}`;
  return `<div class="row">
    <span class="row-ic" data-r="${r.result}">${icon(r.result === 'done' ? 'checkCircle' : 'alertCircle')}</span>
    <span class="row-main"><span class="row-title">${esc(r.title)}</span><span class="row-meta"><span>${L.shortDate(t.date, L.todayKey())}, ${L.fmtHM(t.min)}</span><span>${esc(res)}</span></span></span>
  </div>`;
}

function render(app) {
  const deck = app.state.deck;
  const run = deck.active;
  const runSc = run ? scOf(app, run.sid) : null;
  const pr = run ? D.runProgress(run, runSc) : null;
  const tiles = ['med', 'tac', 'fire', 'go', 'task'].map((k) => {
    const sc = deck.scenarios.find((s) => s.kind === k);
    return quickTile({ kind: D.KIND[k], sc, run: run && run.sid === sc.id ? run : null });
  });
  const customs = deck.scenarios.filter((s) => s.kind === 'custom');
  tiles.push(quickTile({ kind: D.KIND.custom, sc: null, run: run && runSc?.kind === 'custom' ? run : null, count: customs.length }));
  return `<div class="page">
    <h1 class="large-title" data-title-anchor>Швидко</h1>
    ${switcher('deck')}
    <p class="page-sub">Раптове заняття чи доручення — чекліст за один дотик</p>
    ${run ? `<button type="button" class="run-banner" data-act="dkResume">${miniRing({ key: 'deck-banner', value: pr.done, total: pr.total, dim: 44 })}<div><b>Триває: ${esc(run.title)}</b><span>Виконано ${pr.done} з ${pr.total} · обовʼязкових ${pr.reqDone} з ${pr.reqTotal}</span></div>${icon('chev', 'row-chev')}</button>` : ''}
    <div class="deck-grid">${tiles.join('')}</div>
    <section class="section" aria-labelledby="runsH">
      <div class="sec-row"><h2 class="sec-h" id="runsH">Останні запуски</h2></div>
      ${deck.runs.length ? `<div class="list runs">${deck.runs.slice(0, 6).map(runRow).join('')}</div>` : '<p class="foot" style="margin-top:0">Тут зʼявиться підсумок кожного сценарію: коли, скільки кроків і чи все обовʼязкове підтверджено.</p>'}
    </section>
    <p class="foot">Сценарії допомагають організувати особисті справи й навчальні заняття. Склад кожного можна змінити: ${icon('edit')} у чеклісті.</p>
  </div>`;
}

/* ---------- Екран сценарію ---------- */

function runHtml(app) {
  const run = app.state.deck.active;
  const sc = run ? scOf(app, run.sid) : null;
  if (!run || !sc) return '';
  const k = D.KIND[sc.kind];
  const pr = D.runProgress(run, sc);
  const steps = sc.steps.map((s) => checklistItem({ id: s.id, text: s.t, on: !!run.checked[s.id], act: 'dkStep', req: s.req })).join('');
  return `<div class="scr" data-tone="${k.tone}">
    <header class="scr-head">
      <button type="button" class="link" data-act="dkClose">Згорнути</button>
      <span class="scr-head-t">Сценарій</span>
      <button type="button" class="icon-btn" data-act="dkEdit" data-id="${esc(sc.id)}" aria-label="Змінити кроки сценарію">${icon('edit')}</button>
    </header>
    <div class="scr-hero">
      <div class="scr-ic">${icon(k.icon)}</div>
      <h1 class="scr-title">${esc(sc.title)}</h1>
      <p class="scr-sub">${esc(k.desc)}</p>
      <div class="scr-prog" aria-live="polite">
        ${miniRing({ key: `run-${run.id}`, value: pr.done, total: pr.total, dim: 56 })}
        <div><b>${pr.done}/${pr.total}</b><span>кроків</span></div>
        <div><b>${pr.reqDone}/${pr.reqTotal}</b><span>обовʼязкових</span></div>
      </div>
    </div>
    ${sc.steps.length ? `<div class="cl" role="group" aria-label="Кроки">${steps}</div>` : emptyState({ ic: 'list', title: 'У сценарії немає кроків', text: 'Додайте кроки кнопкою редагування вгорі.' })}
    <h3 class="sub-h">Нотатка</h3>
    <textarea class="textarea" id="dkNote" rows="3" maxlength="2000" data-change="dkNote" placeholder="${sc.kind === 'task' ? 'Суть доручення, хто дав, строк…' : 'Необовʼязково'}">${esc(run.note)}</textarea>
    <div class="scr-foot">
      <button type="button" class="btn btn-primary btn-xl btn-block" data-act="dkFinish">${icon('check')}${pr.complete ? 'Завершити — усе підтверджено' : 'Завершити'}</button>
      <p class="hint">${pr.complete ? 'Усі обовʼязкові кроки підтверджено.' : `Не підтверджено обовʼязкових: ${pr.reqTotal - pr.reqDone}. «Готово» буде лише після них.`}</p>
    </div>
  </div>`;
}

function resultHtml(app, r) {
  const sc = scOf(app, r.sid);
  const k = D.KIND[r.kind];
  const mins = Math.max(1, Math.round((r.finishedAt - r.startedAt) / 60000));
  const done = r.result === 'done';
  const noteTitle = r.note.split('\n').map((x) => x.trim()).find(Boolean) || '';
  return `<div class="scr" data-tone="${k.tone}">
    <header class="scr-head"><span></span><span class="scr-head-t">Результат</span><button type="button" class="link strong" data-act="dkClose">Готово</button></header>
    <div class="result-card" data-r="${r.result}">
      <span class="big-check${done ? '' : ' partial'}">${icon(done ? 'check' : 'alert')}</span>
      <h2>${done ? 'Готово' : 'Завершено частково'}</h2>
      <p>${esc(r.title)} · ${r.doneCount} з ${r.total} кроків · ${L.fmtDur(mins)}</p>
      ${done ? '' : `<ul>${r.missing.map((m) => `<li>${icon('alert')}<span>Не підтверджено: ${esc(m)}</span></li>`).join('')}</ul>`}
      ${r.kind === 'task' ? `<button type="button" class="btn btn-primary btn-block" data-act="dkToTask" data-id="${esc(r.id)}">${icon('plus')}Додати в справи${noteTitle ? `: «${esc(noteTitle.slice(0, 40))}»` : ''}</button>` : ''}
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

/* ---------- Редактор сценарію ---------- */

function stepRowEd(s) {
  return `<div class="row sc-step" data-id="${esc(s.id || '')}">
    <input class="input-plain" value="${esc(s.t)}" placeholder="Крок" maxlength="120" aria-label="Текст кроку">
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
    <h3 class="sub-h">Кроки · ${icon('shield', 'crit')} — обовʼязкові</h3>
    <div class="list sc-steps">${s.steps.map(stepRowEd).join('')}</div>
    <button type="button" class="row row-add" style="margin-top:6px" data-act="scAdd">${icon('plus')}<span>Додати крок</span></button>
    <p class="hint">Сценарій завершиться як «Готово», лише коли підтверджено всі обовʼязкові кроки.</p>
    <div class="stack">
      ${!isNew && s.kind !== 'custom' ? `<button type="button" class="btn btn-quiet btn-block" data-act="scReset" data-id="${esc(s.id)}">${icon('reset')}Відновити типовий шаблон</button>` : ''}
      ${!isNew && s.kind === 'custom' ? `<button type="button" class="btn btn-danger-plain btn-block" data-act="scDelete" data-id="${esc(s.id)}">${icon('trash')}Видалити сценарій</button>` : ''}
    </div>
  </form>`, { label: 'Сценарій' });
  if (isNew) $('#sheet [data-act="scAdd"]')?.click();
}

const actions = {
  async deckOpen(app, el) {
    const kind = el.dataset.kind;
    if (kind === 'custom') {
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
    updateScreen(resultHtml(app, r));
  },
  dkRestart(app, el) {
    const sc = scOf(app, el.dataset.id);
    if (!sc) return;
    app.commit((s) => D.startRun(s.deck, sc, Date.now()), { render: false });
    updateScreen(runHtml(app));
    animateRings($('#screen'));
  },
  dkToTask(app, el) {
    const r = app.state.deck.runs.find((x) => x.id === el.dataset.id);
    if (!r) return;
    const lines = r.note.split('\n').map((x) => x.trim()).filter(Boolean);
    const title = (lines[0] || `Доручення від ${L.dayMonth(app.today)}`).slice(0, 300);
    const t = addTask(app, title, 1, app.today, { note: lines.slice(1).join('\n'), cat: 'work' });
    if (t) { closeScreen(); toast('Доручення додано в справи', { label: 'Відкрити', run: () => app.go('tasks') }); }
  },
  dkEdit(app, el) {
    const sc = scOf(app, el.dataset.id);
    if (sc) openEditor(app, sc);
  },
  scAdd(app, el) {
    const list = el.closest('form').querySelector('.sc-steps');
    list.insertAdjacentHTML('beforeend', stepRowEd({ id: '', t: '', req: false }));
    list.lastElementChild.querySelector('input').focus();
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
      t: row.querySelector('input').value.trim().slice(0, 120),
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
    toast('Сценарій збережено');
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
      if (s.deck.active?.sid === sc.id) s.deck.active = null;
    }, { render: false });
    if ($('#screen').open) closeScreen(); else app.render();
  },
};

export default { title: 'Швидко', render, actions };
