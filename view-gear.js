// ОПОРА 365 — «Екіпірування»: Readiness Map. Кожен сегмент показує лише фактичний стан перевірки:
// без недоліків / є недоліки / потребує перевірки / перевірка триває. Ніяких «відсотків готовності».
import * as L from './logic.js';
import * as G from './logic-gear.js';
import { $, esc, icon, seg, openSheet, closeSheet, confirmSheet, choiceSheet, toast, sheetHead, stepper, haptic, openScreen, updateScreen, closeScreen, screenOpen } from './ui.js';
import { ring, statusBadge, emptyState } from './components.js';
import { addTask } from './view-tasks.js';

const ST_ICON = { ok: 'checkCircle', issues: 'alertCircle', needs: 'circleDash', running: 'half' };
const MARK = Object.fromEntries(G.MARKS.map((m) => [m.id, m]));

function catSub(st) {
  if (st.s === 'running') return `Позначено ${st.marked} з ${st.total}`;
  return st.text || '';
}

/* ---------- Карта готовності ---------- */

function readinessRing(gs) {
  const segs = gs.cats.map((c) => (c.st.s === 'running' ? { s: 'running', f: c.st.total ? c.st.marked / c.st.total : 0 } : c.st.s));
  const labels = gs.cats.map((c) => `${c.name}: ${G.STATUS[c.st.s].name}${catSub(c.st) ? `. ${catSub(c.st)}` : ''}. Відкрити`);
  return `<div class="rmap">
    <svg viewBox="0 0 300 300" role="group" aria-label="Карта перевірок екіпірування">
      ${ring({ key: 'rmap', segs, r: 108, w: 34, clickable: { act: 'gearCat', ids: gs.cats.map((c) => c.id) }, labels, icons: gs.cats.map((c) => c.icon) })}
    </svg>
    <div class="rmap-center" aria-hidden="true">
      <span class="rmap-big">${gs.ok}/${gs.total}</span>
      <span class="rmap-cap">перевірено<br>без недоліків</span>
    </div>
  </div>
  <ul class="rmap-legend" aria-label="Підсумок">
    <li>${statusBadge('ok', `Без недоліків: ${gs.ok}`)}</li>
    <li>${statusBadge('issues', `Недоліки: ${gs.issues}`)}</li>
    <li>${statusBadge('needs', `Перевірити: ${gs.needs}`)}</li>
    ${gs.running ? `<li>${statusBadge('running', `Триває: ${gs.running}`)}</li>` : ''}
  </ul>`;
}

function catCard(gear, c) {
  const st = c.st;
  const trail = G.catTrail(gear, c.id, 8);
  return `<button type="button" class="gcard" data-s="${st.s}" data-act="gearCat" data-id="${c.id}">
    <span class="gc-ic">${icon(c.icon)}</span>
    <span class="gc-main">
      <span class="gc-name">${esc(c.name)}</span>
      ${statusBadge(st.s)}
      <span class="gc-sub">${esc(catSub(st))}${st.total ? ` · ${L.count(st.total, ['предмет', 'предмети', 'предметів'])}` : ''}</span>
      ${st.s === 'running' ? `<span class="gc-bar"><span style="--f:${st.total ? (st.marked / st.total).toFixed(3) : 0}"></span></span>` : trail.length ? `<span class="gc-trail" aria-hidden="true">${trail.map((t) => `<i class="${t}"></i>`).join('')}</span>` : ''}
    </span>
    ${icon('chev', 'row-chev')}
  </button>`;
}

function histItem(check, opts = {}) {
  const cat = G.CAT[check.cat];
  const sum = G.summaryOf(check);
  const issues = G.checkIssues(check);
  const t = G.checkTime(check);
  const res = sum.clean ? 'Без недоліків' : [sum.miss ? `відсутнє: ${sum.miss}` : '', sum.issue ? `недоліки: ${sum.issue}` : ''].filter(Boolean).join(' · ');
  return `<div class="hist-item" data-r="${sum.clean ? 'ok' : 'issues'}">
    <span class="hist-ic">${icon(sum.clean ? 'checkCircle' : 'alertCircle')}</span>
    <div>
      <div class="hist-top"><span>${esc(opts.noCat ? G.CHECK_TYPE[check.type].name : cat.name)}</span><time>${opts.showDate ? `${L.shortDate(t.date, L.todayKey())}, ` : ''}${L.fmtHM(t.min)}</time></div>
      <div class="hist-sub">${opts.noCat ? '' : `<span>${esc(G.CHECK_TYPE[check.type].name)}</span>`}<span>${esc(res.replace(/^./, (x) => x.toUpperCase()))}</span><span>предметів: ${sum.total}</span></div>
      ${issues.length ? `<ul class="hist-issues">${issues.map((i) => `<li class="${i.fixed ? 'fixed' : ''}">${icon(i.mark === 'miss' ? 'xCircle' : 'alert')}<span>${esc(i.name)}${i.note ? ` — ${esc(i.note)}` : ''}${i.fixed ? ' (усунуто)' : ''}</span></li>`).join('')}</ul>` : ''}
    </div>
  </div>`;
}

function renderMap(app) {
  const gear = app.state.gear;
  const gs = G.gearSummary(gear);
  const recent = gear.history.slice(0, 4);
  return `<div class="page">
    <h1 class="large-title" data-title-anchor>Екіпірування</h1>
    <p class="page-sub">${gs.ok === gs.total ? 'Усі перевірки актуальні й без недоліків' : `Без недоліків: ${gs.ok} з ${gs.total} · стан лише з ваших перевірок`}</p>
    ${readinessRing(gs)}
    <div class="gcards">${gs.cats.map((c) => catCard(gear, c)).join('')}</div>
    <section class="section" aria-labelledby="histH">
      <div class="sec-row"><h2 class="sec-h" id="histH">Історія перевірок</h2>${gear.history.length > 4 ? '<button type="button" class="link" data-act="tab" data-tab="gear" data-sub="history">Уся історія</button>' : ''}</div>
      ${recent.length ? `<div class="hist">${recent.map((c) => histItem(c, { showDate: true })).join('')}</div>` : emptyState({ ic: 'history', title: 'Перевірок ще не було', text: 'Оберіть категорію і почніть перевірку — тут зʼявиться дата, тип, результат і виявлені недоліки.' })}
    </section>
  </div>`;
}

/* ---------- Сторінка категорії ---------- */

function itemRow(i, today) {
  const exp = i.exp ? (i.exp < today ? `<span class="warn">термін минув ${L.shortDate(i.exp, today)}</span>` : L.diffDays(today, i.exp) <= G.EXP_SOON ? `<span class="soon">термін до ${L.shortDate(i.exp, today)}</span>` : `<span>термін до ${L.shortDate(i.exp, today)}</span>`) : '';
  return `<button type="button" class="row" data-act="gItemEdit" data-id="${esc(i.id)}">
    <span class="row-main"><span class="row-title">${esc(i.name)}${i.critical ? icon('shield', 'crit') : ''}</span>${exp || i.note ? `<span class="row-meta">${exp}${i.note ? `<span>${esc(i.note.slice(0, 60))}</span>` : ''}</span>` : ''}</span>
    <span class="item-qty">×${i.qty}</span>
  </button>`;
}

function renderCat(app, catId) {
  const gear = app.state.gear;
  const c = G.CAT[catId];
  const data = gear.cats[catId];
  const st = G.catStatus(gear, catId);
  const today = app.today;
  const hist = gear.history.filter((h) => h.cat === catId).slice(0, 5);
  let issueBox = '';
  if (st.s === 'issues') {
    const probs = (st.problems || []).map((i) => `<div class="issue-row">
      <span class="row-main"><span class="row-title">${esc(i.name)}</span><span class="row-meta">${st.last.marks[i.id] === 'miss' ? 'відсутнє' : 'недолік'}${st.last.notes[i.id] ? ` · ${esc(st.last.notes[i.id])}` : ''}</span></span>
      <button type="button" class="btn btn-sm btn-tinted" data-act="gFix" data-cat="${catId}" data-id="${esc(i.id)}">${icon('check')}Усунуто</button></div>`).join('');
    const exp = st.expired.map((i) => `<div class="issue-row"><span class="row-main"><span class="row-title">${esc(i.name)}</span><span class="row-meta">термін минув ${L.shortDate(i.exp, today)} · оновіть дату в предметі</span></span></div>`).join('');
    issueBox = `<div class="issue-box" role="region" aria-label="Недоліки"><h3>${icon('alert')}Недоліки</h3>${probs}${exp}</div>`;
  }
  const btn = st.s === 'running'
    ? `<button type="button" class="btn btn-primary btn-xl btn-block" data-act="gCheck" data-cat="${catId}">${icon('play')}Продовжити перевірку · ${st.marked} з ${st.total}</button>`
    : `<button type="button" class="btn btn-primary btn-xl btn-block" data-act="gCheck" data-cat="${catId}"${data.items.length ? '' : ' disabled'}>${icon('shieldCheck')}Почати перевірку</button>`;
  return `<div class="page">
    <div class="cat-head" data-s="${st.s}">
      <span class="gc-ic">${icon(c.icon)}</span>
      <div><h1 data-title-anchor>${esc(c.name)}</h1>${statusBadge(st.s, st.s === 'running' ? `Триває · ${st.marked} з ${st.total}` : '')}</div>
    </div>
    <p class="page-sub">${esc(catSub(st))}${st.last ? ` · ${G.CHECK_TYPE[st.last.type].name.toLowerCase()}` : ''} · період ${L.daysWord(data.period)}</p>
    ${btn}
    ${issueBox}
    <section class="section" aria-labelledby="itemsH">
      <div class="sec-row"><h2 class="sec-h" id="itemsH">Предмети<span class="sec-count">${data.items.length}</span></h2></div>
      <div class="list">
        ${data.items.map((i) => itemRow(i, today)).join('')}
        <button type="button" class="row row-add" data-act="gItemEdit" data-id="new">${icon('plus')}<span>Додати предмет</span></button>
      </div>
      <p class="foot">${icon('shield', 'crit')} — обовʼязковий предмет. Нові предмети вважаються неперевіреними, доки їх не позначено в перевірці. Назви й кількість зберігаються лише на цьому пристрої.</p>
    </section>
    <section class="section">
      <h2 class="sec-h" style="margin-bottom:10px">Перевіряти кожні</h2>
      ${seg('Період перевірки', G.PERIODS.map((p) => ({ id: p, name: `${p} дн.` })), data.period, 'gPeriod')}
    </section>
    <section class="section" aria-labelledby="chH">
      <div class="sec-row"><h2 class="sec-h" id="chH">Перевірки</h2></div>
      ${hist.length ? `<div class="hist">${hist.map((h) => histItem(h, { noCat: true, showDate: true })).join('')}</div>` : '<p class="foot" style="margin-top:0">Ця категорія ще не перевірялась.</p>'}
    </section>
  </div>`;
}

/* ---------- Історія ---------- */

function renderHistory(app) {
  const hist = app.state.gear.history;
  const today = app.today;
  let lastDay = '';
  const out = hist.map((h) => {
    const d = G.checkTime(h).date;
    const head = d !== lastDay ? `<p class="hist-day">${d === today ? 'Сьогодні' : L.shortDate(d, today) === 'учора' ? 'Учора' : `${L.weekdayName(d)}, ${L.dayMonth(d)}`}</p>` : '';
    lastDay = d;
    return head + histItem(h);
  }).join('');
  return `<div class="page">
    <h1 class="large-title" data-title-anchor>Історія перевірок</h1>
    <p class="page-sub">${hist.length ? `Записів: ${hist.length} · зберігаються останні ${G.HISTORY_MAX}` : 'Записів ще немає'}</p>
    <div class="hist">${out || emptyState({ ic: 'history', title: 'Перевірок ще не було' })}</div>
  </div>`;
}

function render(app) {
  const sub = app.route.sub;
  if (sub === 'history') return renderHistory(app);
  if (G.CAT[sub]) return renderCat(app, sub);
  return renderMap(app);
}

function title(app) {
  const sub = app.route.sub;
  if (sub === 'history') return 'Історія';
  if (G.CAT[sub]) return G.CAT[sub].short;
  return 'Екіпірування';
}

function chrome(app) {
  const sub = app.route.sub;
  if (sub) return { left: `<button type="button" class="back-btn" data-act="back">${icon('back')}Екіпірування</button>` };
  return { right: `<button type="button" class="icon-btn" data-act="tab" data-tab="gear" data-sub="history" aria-label="Історія перевірок">${icon('history')}</button>` };
}

/* ---------- Екран перевірки ---------- */

function checkHtml(app, catId) {
  const gear = app.state.gear;
  const c = G.CAT[catId];
  const run = gear.active[catId];
  if (!run) return '';
  const items = gear.cats[catId].items;
  const pr = G.checkProgress(gear, catId);
  const rows = items.map((i) => {
    const m = run.marks[i.id] || '';
    const note = run.notes[i.id] || '';
    return `<div class="mark-row">
      <div class="mark-name">${esc(i.name)}${i.critical ? icon('shield', 'crit') : ''}<span class="item-qty">×${i.qty}</span></div>
      ${i.exp ? `<div class="mark-sub">Термін придатності до ${L.shortDate(i.exp, app.today)}</div>` : ''}
      <div class="marks" role="group" aria-label="${esc(i.name)}">
        ${G.MARKS.map((mk) => `<button type="button" class="mark" data-m="${mk.id}" aria-pressed="${m === mk.id}" data-act="gMark" data-cat="${catId}" data-id="${esc(i.id)}" data-v="${mk.id}">${icon(mk.icon)}${mk.name}</button>`).join('')}
      </div>
      ${m === 'issue' || m === 'miss' ? `<input class="mark-note" id="note-${esc(i.id)}" type="text" maxlength="300" placeholder="${m === 'miss' ? 'Що сталося? (необовʼязково)' : 'Який недолік? (необовʼязково)'}" value="${esc(note)}" data-change="gNote" data-cat="${catId}" data-id="${esc(i.id)}" aria-label="Опис недоліку: ${esc(i.name)}">` : ''}
    </div>`;
  }).join('');
  return `<div class="scr check-scr" data-tone="${pr.left ? 'blue' : 'teal'}">
    <header class="scr-head">
      <button type="button" class="link" data-act="gCheckClose">Згорнути</button>
      <span class="scr-head-t">Перевірка</span>
      <button type="button" class="icon-btn" data-act="gCheckCancel" aria-label="Скасувати перевірку">${icon('trash')}</button>
    </header>
    <div class="scr-hero" data-tone="teal">
      <div class="scr-ic">${icon(c.icon)}</div>
      <h1 class="scr-title">${esc(c.name)}</h1>
      <p class="scr-sub">${esc(G.CHECK_TYPE[run.type].name)} · розпочато о ${L.fmtHM(L.kyivParts(run.startedAt).min)}</p>
      <div class="scr-prog" aria-live="polite"><div><b>${pr.marked}</b><span>позначено</span></div><div><b>${pr.left}</b><span>залишилось</span></div></div>
    </div>
    <div class="list">${rows}</div>
    <div class="scr-foot">
      <button type="button" class="btn btn-primary btn-xl btn-block" data-act="gFinish" data-cat="${catId}"${pr.can ? '' : ' disabled'}>${icon('check')}Завершити перевірку</button>
      <p class="hint">${pr.can ? 'Усі предмети позначено.' : `Позначте ще ${L.count(pr.left, ['предмет', 'предмети', 'предметів'])} — інакше результат не відобразить реальний стан.`}</p>
    </div>
  </div>`;
}

function resultHtml(app, check) {
  const c = G.CAT[check.cat];
  const sum = G.summaryOf(check);
  const issues = G.checkIssues(check);
  return `<div class="scr">
    <header class="scr-head"><span></span><span class="scr-head-t">Результат</span><button type="button" class="link strong" data-act="gCheckClose">Готово</button></header>
    <div class="result-card" data-r="${sum.clean ? 'done' : 'partial'}">
      <span class="big-check${sum.clean ? '' : ' partial'}">${icon(sum.clean ? 'check' : 'alert')}</span>
      <h2>${sum.clean ? 'Без недоліків' : 'Знайдено недоліки'}</h2>
      <p>${esc(c.name)} · ${esc(G.CHECK_TYPE[check.type].name.toLowerCase())} · перевірено предметів: ${sum.total}</p>
      ${issues.length ? `<ul>${issues.map((i) => `<li>${icon(i.mark === 'miss' ? 'xCircle' : 'alert')}<span><b>${esc(i.name)}</b> — ${i.mark === 'miss' ? 'відсутнє' : 'недолік'}${i.note ? `: ${esc(i.note)}` : ''}</span></li>`).join('')}</ul>
        <button type="button" class="btn btn-primary btn-block" data-act="gIssueTask" data-id="${esc(check.id)}">${icon('plus')}Додати в справи</button>` : ''}
      <button type="button" class="btn btn-quiet btn-block" data-act="gCheckClose">Закрити</button>
    </div>
  </div>`;
}

let screenCat = '';
function showCheck(app, catId, from) {
  screenCat = catId;
  openScreen(checkHtml(app, catId), { label: `Перевірка: ${G.CAT[catId].name}`, from, onClose: () => { screenCat = ''; app.screenTick = null; app.render(); } });
  app.screenTick = null;
}

// Почати або продовжити перевірку категорії.
export async function openCheckFlow(app, catId, from = null, resume = false) {
  const gear = app.state.gear;
  if (!gear.cats[catId].items.length) { app.go('gear', catId); return; }
  if (!gear.active[catId] && !resume) {
    const type = await choiceSheet({
      title: G.CAT[catId].name,
      text: 'Тип перевірки',
      options: G.CHECK_TYPES.map((t) => ({ id: t.id, label: t.name, icon: t.id === 'before' ? 'exit' : t.id === 'after' ? 'history' : t.id === 'extra' ? 'alert' : 'calendar' })),
    });
    if (!type) return;
    app.commit((s) => { G.startCheck(s.gear, catId, type, Date.now()); }, { render: false });
    await new Promise((r) => setTimeout(r, 220));
  }
  if (!app.state.gear.active[catId]) return;
  showCheck(app, catId, from);
}

/* ---------- Редактор предмета ---------- */

function openItem(app, el) {
  const catId = app.route.sub;
  const data = app.state.gear.cats[catId];
  if (!data) return;
  const isNew = el.dataset.id === 'new';
  const i = isNew ? { id: 'new', name: '', qty: 1, critical: false, exp: '', note: '' } : data.items.find((x) => x.id === el.dataset.id);
  if (!i) return;
  openSheet(`<form class="sheet-form" data-submit="gItemSave" data-id="${esc(i.id)}" data-cat="${catId}" autocomplete="off">
    ${sheetHead(isNew ? 'Новий предмет' : 'Предмет', { cancel: 'Скасувати', done: 'Готово', submit: true })}
    <div class="list"><label class="row field"><input class="input-plain" name="name" value="${esc(i.name)}" placeholder="Назва предмета" maxlength="80" enterkeyhint="done" aria-label="Назва предмета"${isNew ? ' data-focus' : ''}></label></div>
    <div class="list">
      <div class="row field-row"><span class="row-label">Кількість</span>${stepper('qty', i.qty, 1, 999, 'Кількість', 1, 'шт')}</div>
      <label class="row field-row"><span class="row-main"><span class="row-title">Обовʼязковий</span><span class="row-meta">Позначка ${icon('shield', 'crit')} у списку і перевірці</span></span><input type="checkbox" class="switch" name="critical"${i.critical ? ' checked' : ''}></label>
      <label class="row field-row"><span class="row-main"><span class="row-title">Термін придатності</span><span class="row-meta">Для ліків, батарей, пайків — необовʼязково</span></span><input class="date-input" type="date" name="exp" value="${esc(i.exp)}"></label>
    </div>
    <h3 class="sub-h">Примітка</h3>
    <textarea class="textarea" name="note" rows="2" maxlength="300" placeholder="Необовʼязково. Не вносьте службові номери, якщо публікуєте копії.">${esc(i.note)}</textarea>
    ${isNew ? '' : `<div class="row2">
      <button type="button" class="btn btn-quiet" data-act="gItemMove" data-id="${esc(i.id)}" data-d="-1">${icon('up')}Вище</button>
      <button type="button" class="btn btn-quiet" data-act="gItemMove" data-id="${esc(i.id)}" data-d="1">${icon('down')}Нижче</button>
    </div>
    <div class="stack"><button type="button" class="btn btn-danger-plain btn-block" data-act="gItemDelete" data-id="${esc(i.id)}">${icon('trash')}Видалити предмет</button></div>`}
  </form>`, { label: 'Предмет' });
}

const actions = {
  gearCat(app, el) { app.go('gear', el.dataset.id); },
  gCheck(app, el) { openCheckFlow(app, el.dataset.cat, el); },
  gCheckClose() { closeScreen(); },
  async gCheckCancel(app) {
    const cat = screenCat;
    if (!cat) return;
    const ok = await confirmSheet({ title: 'Скасувати перевірку?', text: 'Позначки цієї перевірки буде видалено. Попередні результати залишаться.', ok: 'Скасувати перевірку', danger: true, cancel: 'Продовжити' });
    if (!ok) return;
    app.commit((s) => G.cancelCheck(s.gear, cat), { render: false });
    closeScreen();
  },
  gMark(app, el) {
    const { cat, id, v } = el.dataset;
    const run = app.state.gear.active[cat];
    if (!run) return;
    const same = run.marks[id] === v;
    app.commit((s) => G.markItem(s.gear, cat, id, same ? null : v), { render: false });
    if (!same && v === 'ok') haptic();
    updateScreen(checkHtml(app, cat));
    if (!same && v !== 'ok') document.getElementById(`note-${id}`)?.focus({ preventScroll: true });
  },
  gNote(app, el) {
    const { cat, id } = el.dataset;
    const run = app.state.gear.active[cat];
    if (!run || !run.marks[id]) return;
    app.commit((s) => G.markItem(s.gear, cat, id, run.marks[id], el.value), { render: false });
  },
  gFinish(app, el) {
    const cat = el.dataset.cat;
    let res = null;
    app.commit((s) => { res = G.finishCheck(s.gear, cat, Date.now()); }, { render: false });
    if (!res?.ok) { toast(res?.error || 'Не вдалося завершити перевірку'); return; }
    haptic();
    updateScreen(resultHtml(app, res.check));
  },
  gIssueTask(app, el) {
    const check = app.state.gear.history.find((h) => h.id === el.dataset.id);
    if (!check) return;
    const issues = G.checkIssues(check);
    const note = issues.map((i) => `• ${i.name} — ${i.mark === 'miss' ? 'відсутнє' : 'недолік'}${i.note ? `: ${i.note}` : ''}`).join('\n');
    const t = addTask(app, `Усунути недоліки: ${G.CAT[check.cat].name}`, 1, app.today, { note, cat: 'work' });
    if (t) {
      closeScreen();
      toast('Справу створено', { label: 'Відкрити', run: () => app.go('tasks') });
    }
  },
  gFix(app, el) {
    const { cat, id } = el.dataset;
    app.commit((s) => G.fixIssue(s.gear, cat, id));
    haptic();
    toast('Позначено як усунуте', { label: 'Скасувати', run: () => app.commit((s) => { const l = G.lastCheck(s.gear, cat); if (l) delete l.fixed[id]; }) });
  },
  gPeriod(app, el) {
    const cat = app.route.sub;
    app.commit((s) => { s.gear.cats[cat].period = +el.dataset.v; });
  },
  gItemEdit: openItem,
  gItemSave(app, form) {
    const cat = form.dataset.cat;
    const f = form.elements;
    const name = f.name.value.trim();
    if (!name) { f.name.focus(); return; }
    const raw = { name, qty: f.qty.value, critical: f.critical.checked, exp: f.exp.value, note: f.note.value };
    app.commit((s) => {
      const list = s.gear.cats[cat].items;
      if (form.dataset.id === 'new') list.push(G.cleanItem(raw, Date.now()));
      else {
        const it = list.find((x) => x.id === form.dataset.id);
        if (it) Object.assign(it, G.cleanItem({ ...raw, id: it.id, addedAt: it.addedAt }));
      }
    });
    closeSheet();
  },
  gItemMove(app, el) {
    const cat = app.route.sub;
    app.commit((s) => { s.gear.cats[cat].items = L.moveItem(s.gear.cats[cat].items, el.dataset.id, +el.dataset.d); });
  },
  gItemDelete(app, el) {
    const cat = app.route.sub;
    const list = app.state.gear.cats[cat].items;
    const i = list.findIndex((x) => x.id === el.dataset.id);
    if (i < 0) return;
    const removed = list[i];
    app.commit((s) => {
      s.gear.cats[cat].items.splice(i, 1);
      const run = s.gear.active[cat];
      if (run) { delete run.marks[removed.id]; delete run.notes[removed.id]; }
    });
    closeSheet();
    toast('Предмет видалено', { label: 'Скасувати', run: () => app.commit((s) => { s.gear.cats[cat].items.splice(i, 0, removed); }) });
  },
};

export default {
  title,
  render,
  chrome,
  actions,
  validSub: (app, sub) => (sub === 'history' || G.CAT[sub] ? sub : ''),
  screenOpen: () => screenOpen() && !!screenCat,
};
