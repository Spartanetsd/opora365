// ОПОРА 365 — «Готовність»: центр уваги до спорядження. Карта перевірок, проблемні предмети,
// щоденна, перед чергуванням, щотижнева й на вимогу перевірки, історія. Лише фактичні статуси.
// Особистий допоміжний облік, а не заміна службової документації.
import * as L from './logic.js';
import * as G from './logic-gear.js';
import { $, esc, icon, seg, openSheet, closeSheet, confirmSheet, choiceSheet, toast, sheetHead, stepper, haptic, openScreen, updateScreen, closeScreen, screenOpen, setScreenBg } from './ui.js';
import { catChip, itemChip, emptyState, photoHead, miniRing, animateRings } from './components.js';
import { addTask } from './view-tasks.js';

const TYPE_ICON = { daily: 'sun', duty: 'shieldCheck', weekly: 'calendar', demand: 'search' };
const catName = (app, id) => G.catMeta(app.state.gear, id).name;

/* ---------- Карта перевірок ---------- */

function statusBar(st) {
  const total = st.total || 1;
  const c = st.count;
  const parts = [['ok', c.ok], ['unchecked', c.unchecked], ['refill', c.refill], ['broken', c.broken], ['missing', c.missing]].filter(([, n]) => n);
  return `<span class="sbar" aria-hidden="true">${parts.map(([k, n]) => `<i data-k="${k}" style="flex:${n}"></i>`).join('')}${st.total ? '' : '<i data-k="none" style="flex:1"></i>'}</span>`;
}

function catTile(c) {
  const st = c.st;
  const sub = st.s === 'running' ? st.text : st.total ? `${st.text}. ${L.count(st.total, ['предмет', 'предмети', 'предметів'])}` : st.text;
  return `<button type="button" class="ctile" data-s="${st.s}" data-act="gearCat" data-id="${esc(c.id)}" aria-label="${esc(c.name)}: ${esc(G.STATUS[st.s].name)}. ${esc(sub)}">
    <span class="ctile-ic" aria-hidden="true">${icon(c.icon)}</span>
    <span class="ctile-name">${esc(c.name)}</span>
    ${catChip(st.s)}
    <span class="ctile-sub">${esc(sub)}</span>
    ${statusBar(st)}
  </button>`;
}

function histItem(app, check, opts = {}) {
  const cat = G.catMeta(app.state.gear, check.cat);
  const sum = G.summaryOf(check);
  const issues = G.checkIssues(check);
  const t = G.checkTime(check);
  const parts = [];
  if (sum.missing) parts.push(`відсутнє: ${sum.missing}`);
  if (sum.broken) parts.push(`несправне: ${sum.broken}`);
  if (sum.refill) parts.push(`поповнити: ${sum.refill}`);
  const res = sum.clean ? 'Без зауважень' : parts.join(', ').replace(/^./, (x) => x.toUpperCase());
  return `<div class="hist-item" data-r="${sum.clean ? 'ok' : 'issues'}">
    <span class="hist-ic" aria-hidden="true">${icon(sum.clean ? 'checkCircle' : 'alertCircle')}</span>
    <div class="hist-main">
      <div class="hist-top"><span>${esc(opts.noCat ? G.checkTypeName(check.type) : cat.name)}</span><time>${opts.showDate ? `${L.shortDate(t.date, L.todayKey())}, ` : ''}${L.fmtHM(t.min)}</time></div>
      <div class="hist-sub">${opts.noCat ? '' : `<span>${esc(G.checkTypeName(check.type))}</span>`}<span>${esc(res)}</span><span>предметів: ${sum.total}</span></div>
      ${issues.length ? `<ul class="hist-issues">${issues.map((i) => `<li class="${i.fixed ? 'fixed' : ''}">${icon(i.mark === 'missing' ? 'xCircle' : i.mark === 'refill' ? 'refill' : 'alert')}<span>${esc(i.name)}: ${esc(G.MARK[i.mark].long.toLowerCase())}${i.note ? `, ${esc(i.note)}` : ''}${i.fixed ? ' (усунуто)' : ''}</span></li>`).join('')}</ul>` : ''}
    </div>
  </div>`;
}

function problemRow(app, p) {
  const today = app.today;
  const st = p.st;
  let meta;
  if (p.soonOnly) meta = `термін до ${L.shortDate(p.item.exp, today)}`;
  else if (st.reason === 'expired') meta = `термін минув ${L.shortDate(p.item.exp, today)}`;
  else meta = `${G.ITEM_ST[st.s].name.toLowerCase()}${st.note ? `: ${st.note}` : ''}`;
  const tone = p.soonOnly ? 'amber' : G.ITEM_ST[st.s].tone;
  const fix = !p.soonOnly && st.reason !== 'expired'
    ? `<button type="button" class="btn btn-sm btn-tinted" data-act="gFix" data-cat="${esc(p.cat)}" data-id="${esc(p.item.id)}">${icon('check')}${st.s === 'refill' ? 'Поповнено' : 'Усунуто'}</button>`
    : `<button type="button" class="btn btn-sm btn-quiet" data-act="gItemEdit" data-cat="${esc(p.cat)}" data-id="${esc(p.item.id)}">${icon('calendar')}Дата</button>`;
  return `<div class="row prow" data-tone="${tone}">
    <span class="row-lead" aria-hidden="true">${icon(p.soonOnly ? 'clock' : G.ITEM_ST[st.s].icon)}</span>
    <span class="row-main"><span class="row-title">${esc(p.item.name)}</span><span class="row-meta"><span>${esc(p.catName)}</span><span>${esc(meta)}</span></span></span>
    ${fix}
  </div>`;
}

function renderMap(app) {
  const gear = app.state.gear;
  const gs = G.gearSummary(gear);
  const probs = G.problemList(gear);
  const realProbs = probs.filter((p) => !p.soonOnly);
  const items = Object.values(gear.cats).reduce((n, c) => n + c.items.length, 0);
  const daily = G.queueFor(gear, 'daily').map((id) => G.catMeta(gear, id).short);
  const duty = G.queueFor(gear, 'duty');
  const sub = gs.running ? 'Перевірка триває' : gs.total ? `Без зауважень: ${gs.ok} з ${gs.total} ${L.plural(gs.total, ['категорії', 'категорій', 'категорій'])}` : 'Додайте предмети, щоб перевіряти їх';
  const recent = gear.history.slice(0, 4);
  if (!items) {
    return `<div class="page">
      ${photoHead({ title: 'Готовність', sub: 'Ще немає жодного предмета' })}
      ${emptyState({ img: 'empty-equipment.webp', title: 'Каталог спорядження порожній', text: 'Почніть із категорії, яку перевіряєте найчастіше.', action: `<button type="button" class="btn btn-primary" data-act="gearCat" data-id="issued">${icon('plus')}Додати перший предмет</button>` })}
    </div>`;
  }
  return `<div class="page">
    ${photoHead({ title: 'Готовність', sub: esc(sub) })}
    <div class="check-actions">
      <button type="button" class="cta" data-act="gQueue" data-type="daily">${icon('sun')}<span class="cta-t">Щоденна перевірка</span><span class="cta-s">${esc(daily.join(', ') || 'Усі категорії')}</span></button>
      <button type="button" class="cta" data-act="gQueue" data-type="duty">${icon('shieldCheck')}<span class="cta-t">Перед чергуванням</span><span class="cta-s">${L.count(duty.length, ['категорія', 'категорії', 'категорій'])}</span></button>
    </div>
    <button type="button" class="soft-link" data-act="gOther">${icon('calendar')}Щотижнева або на вимогу</button>
    <section class="section" aria-labelledby="mapH">
      <div class="sec-row"><h2 class="sec-h" id="mapH">Карта перевірок</h2><span class="legend" aria-hidden="true"><i data-k="ok"></i>перевірено<i data-k="unchecked"></i>ні<i data-k="missing"></i>проблема</span></div>
      <div class="cmap">${gs.cats.map(catTile).join('')}
        ${gear.custom.length < G.CUSTOM_MAX ? `<button type="button" class="ctile ctile-add" data-act="gCatNew">${icon('plus')}<span class="ctile-name">Нова категорія</span><span class="ctile-sub">Власний перелік для перевірки</span></button>` : ''}
      </div>
    </section>
    ${probs.length ? `<section class="section" aria-labelledby="probH">
      <div class="sec-row"><h2 class="sec-h" id="probH">Проблемні предмети<span class="sec-count">${realProbs.length}</span></h2>${realProbs.length ? '<button type="button" class="link" data-act="gProbTask">У справи</button>' : ''}</div>
      <div class="list">${probs.map((p) => problemRow(app, p)).join('')}</div>
    </section>` : ''}
    <section class="section" aria-labelledby="histH">
      <div class="sec-row"><h2 class="sec-h" id="histH">Історія перевірок</h2>${gear.history.length > 4 ? '<button type="button" class="link" data-act="tab" data-tab="gear" data-sub="history">Уся історія</button>' : ''}</div>
      ${recent.length ? `<div class="hist">${recent.map((c) => histItem(app, c, { showDate: true })).join('')}</div>` : '<p class="sec-note">Тут зʼявиться дата, тип, результат і виявлені проблеми кожної перевірки.</p>'}
    </section>
    <p class="foot">Особистий допоміжний облік, а не заміна службової документації. Стан показує лише ваші позначки. Не вносьте службові номери, якщо ділитеся копіями.</p>
  </div>`;
}

/* ---------- Сторінка категорії ---------- */

function itemRow(app, cat, i, st) {
  const today = app.today;
  const meta = [];
  meta.push(`<span class="owner" data-o="${i.owner}">${i.owner === 'issued' ? 'Підзвітне' : 'Особисте'}</span>`);
  if (st.at && st.s !== 'unchecked') meta.push(`<span>${st.age === 0 ? 'сьогодні' : st.age === 1 ? 'учора' : `${L.daysWord(st.age)} тому`}</span>`);
  else if (st.reason === 'stale') meta.push(`<span>давно: ${L.daysWord(st.age)} тому</span>`);
  if (i.exp) meta.push(`<span class="${st.expired ? 'warn' : st.soon ? 'soon' : ''}">термін до ${L.shortDate(i.exp, today)}</span>`);
  if (st.note && st.s !== 'ok') meta.push(`<span>${esc(st.note)}</span>`);
  return `<button type="button" class="row irow" data-act="gItemEdit" data-cat="${esc(cat)}" data-id="${esc(i.id)}">
    <span class="row-main"><span class="row-title">${esc(i.name)}${i.critical ? icon('shield', 'crit') : ''}</span><span class="row-meta">${meta.join('')}</span></span>
    <span class="irow-end"><span class="item-qty">×${i.qty}</span>${itemChip(st)}</span>
  </button>`;
}

function renderCat(app, catId) {
  const gear = app.state.gear;
  const c = G.catMeta(gear, catId);
  const data = gear.cats[catId];
  const st = G.catStatus(gear, catId);
  const hist = gear.history.filter((h) => h.cat === catId).slice(0, 5);
  const add = `<button type="button" class="row row-add" data-act="gItemEdit" data-cat="${esc(catId)}" data-id="new">${icon('plus')}<span>Додати предмет</span></button>`;
  const head = `<div class="cat-head" data-s="${st.s}">
      <span class="ctile-ic" aria-hidden="true">${icon(c.icon)}</span>
      <div><h1 data-title-anchor>${esc(c.name)}</h1>${catChip(st.s, st.s === 'running' ? `Триває, ${st.marked} з ${st.total}` : '')}</div>
    </div>`;
  if (!data.items.length) {
    return `<div class="page page-plain">${head}
      ${emptyState({ img: 'empty-equipment.webp', title: 'У категорії ще немає предметів', text: 'Додайте те, що перевіряєте: назву, кількість, підзвітне чи особисте.', action: `<button type="button" class="btn btn-primary" data-act="gItemEdit" data-cat="${esc(catId)}" data-id="new">${icon('plus')}Додати перший предмет</button>` })}
      ${catSettings(app, catId, c)}
    </div>`;
  }
  const btn = st.s === 'running'
    ? `<button type="button" class="btn btn-primary btn-xl btn-block" data-act="gResume" data-cat="${esc(catId)}">${icon('play')}Продовжити перевірку: ${st.marked} з ${st.total}</button>`
    : `<button type="button" class="btn btn-primary btn-xl btn-block" data-act="gCheck" data-cat="${esc(catId)}">${icon('shieldCheck')}Почати перевірку</button>`;
  return `<div class="page page-plain">
    ${head}
    <p class="page-sub">${esc(st.text)}${st.last ? `. Остання: ${esc(G.checkTypeName(st.last.type).toLowerCase())}` : ''}. Період ${L.daysWord(data.period)}</p>
    ${btn}
    <section class="section" aria-labelledby="itemsH">
      <div class="sec-row"><h2 class="sec-h" id="itemsH">Предмети<span class="sec-count">${data.items.length}</span></h2></div>
      <div class="list">${st.items.map((x) => itemRow(app, catId, x.item, x.st)).join('')}${add}</div>
      <p class="foot">${icon('shield', 'crit')} — обовʼязковий предмет. Новий предмет вважається неперевіреним, доки його не позначено в перевірці.</p>
    </section>
    ${catSettings(app, catId, c)}
    <section class="section" aria-labelledby="chH">
      <div class="sec-row"><h2 class="sec-h" id="chH">Перевірки</h2></div>
      ${hist.length ? `<div class="hist">${hist.map((h) => histItem(app, h, { noCat: true, showDate: true })).join('')}</div>` : '<p class="sec-note">Ця категорія ще не перевірялась.</p>'}
    </section>
  </div>`;
}

function catSettings(app, catId, c) {
  const data = app.state.gear.cats[catId];
  return `<section class="section" aria-labelledby="setH">
    <div class="sec-row"><h2 class="sec-h" id="setH">Налаштування</h2></div>
    <p class="sub-h" style="margin-top:0">Перевіряти кожні, днів</p>
    ${seg('Період перевірки', G.PERIODS.map((p) => ({ id: p, name: `${p}` })), data.period, 'gPeriod')}
    <div class="list" style="margin-top:12px">
      <label class="row field-row"><span class="row-main"><span class="row-title">Перед чергуванням</span><span class="row-meta">Входить у набір перевірки перед чергуванням</span></span><input type="checkbox" class="switch" data-change="gDuty" data-cat="${esc(catId)}"${data.duty ? ' checked' : ''}></label>
    </div>
    <div class="row2">
      ${c.builtIn ? `<button type="button" class="btn btn-quiet" data-act="gDefaults" data-cat="${esc(catId)}">${icon('reset')}Типові предмети</button>` : `<button type="button" class="btn btn-quiet" data-act="gCatEdit" data-cat="${esc(catId)}">${icon('edit')}Змінити</button>`}
      ${c.builtIn ? '' : `<button type="button" class="btn btn-danger-plain" data-act="gCatDelete" data-cat="${esc(catId)}">${icon('trash')}Видалити</button>`}
    </div>
  </section>`;
}

/* ---------- Історія ---------- */

function renderHistory(app) {
  const hist = app.state.gear.history;
  const today = app.today;
  let lastDay = '';
  const out = hist.map((h) => {
    const d = G.checkTime(h).date;
    const head = d !== lastDay ? `<p class="day-h">${d === today ? 'Сьогодні' : L.diffDays(d, today) === 1 ? 'Учора' : `${L.weekdayName(d)}, ${L.dayMonth(d)}`}</p>` : '';
    lastDay = d;
    return head + histItem(app, h);
  }).join('');
  return `<div class="page page-plain">
    <h1 class="large-title" data-title-anchor>Історія перевірок</h1>
    <p class="page-sub">${hist.length ? `Записів: ${hist.length}. Кожна перевірка — окремий запис, зберігаються останні ${G.HISTORY_MAX}` : 'Записів ще немає'}</p>
    <div class="hist">${out || emptyState({ ic: 'history', title: 'Перевірок ще не було' })}</div>
  </div>`;
}

function render(app) {
  const sub = app.route.sub;
  if (sub === 'history') return renderHistory(app);
  if (sub && app.state.gear.cats[sub]) return renderCat(app, sub);
  return renderMap(app);
}

function title(app) {
  const sub = app.route.sub;
  if (sub === 'history') return 'Історія';
  if (sub && app.state.gear.cats[sub]) return G.catMeta(app.state.gear, sub).short;
  return 'Готовність';
}

function chrome(app) {
  if (app.route.sub) return {};
  return { right: `<button type="button" class="icon-btn" data-act="tab" data-tab="gear" data-sub="history" aria-label="Історія перевірок">${icon('history')}</button>` };
}

const backdrop = (app) => (app.route.sub ? null : { src: 'readiness-visual.webp', kind: 'header', pos: '50% 42%' });

/* ---------- Екран перевірки ---------- */

let queue = null; // { type, cats, i } — набір категорій однієї перевірки
let screenCat = '';

function checkHtml(app, catId) {
  const gear = app.state.gear;
  const c = G.catMeta(gear, catId);
  const run = gear.active[catId];
  if (!run) return '';
  const items = gear.cats[catId].items;
  const pr = G.checkProgress(gear, catId);
  const rows = items.map((i) => {
    const m = run.marks[i.id] || '';
    const note = run.notes[i.id] || '';
    const prev = G.itemStatus(gear, catId, i);
    return `<div class="mark-row">
      <div class="mark-name"><span>${esc(i.name)}${i.critical ? icon('shield', 'crit') : ''}</span><span class="item-qty">×${i.qty}</span></div>
      <div class="mark-sub">${i.owner === 'issued' ? 'Підзвітне' : 'Особисте'}${prev.at ? `, минулого разу: ${esc(G.ITEM_ST[prev.s].name.toLowerCase())}` : ''}${i.exp ? `, термін до ${L.shortDate(i.exp, app.today)}` : ''}</div>
      <div class="marks" role="group" aria-label="${esc(i.name)}">
        ${G.MARKS.map((mk) => `<button type="button" class="mark" data-m="${mk.id}" aria-pressed="${m === mk.id}" data-act="gMark" data-cat="${esc(catId)}" data-id="${esc(i.id)}" data-v="${mk.id}">${icon(mk.icon)}<span>${mk.name}</span></button>`).join('')}
      </div>
      ${m && m !== 'ok' ? `<input class="mark-note" id="note-${esc(i.id)}" type="text" maxlength="300" placeholder="${m === 'missing' ? 'Що сталося? (необовʼязково)' : m === 'refill' ? 'Скільки бракує? (необовʼязково)' : 'Що несправне? (необовʼязково)'}" value="${esc(note)}" data-change="gNote" data-cat="${esc(catId)}" data-id="${esc(i.id)}" aria-label="Примітка: ${esc(i.name)}">` : ''}
    </div>`;
  }).join('');
  const qInfo = queue && queue.cats.includes(catId) ? `${queue.cats.indexOf(catId) + 1} з ${queue.cats.length}, ` : '';
  return `<div class="scr check-scr">
    <header class="scr-head">
      <button type="button" class="link" data-act="gCheckClose">Згорнути</button>
      <span class="scr-head-t">${esc(G.checkTypeName(run.type))}</span>
      <button type="button" class="icon-btn" data-act="gCheckCancel" aria-label="Скасувати перевірку">${icon('trash')}</button>
    </header>
    <div class="scr-hero" data-tone="teal">
      <div class="scr-ic">${icon(c.icon)}</div>
      <h1 class="scr-title">${esc(c.name)}</h1>
      <p class="scr-sub">${qInfo}розпочато о ${L.fmtHM(L.kyivParts(run.startedAt).min)}</p>
      <div class="scr-prog" aria-live="polite">${miniRing({ key: `chk-${run.id}`, value: pr.marked, total: pr.total, dim: 52, tone: 'teal' })}<div><b>${pr.marked}</b><span>позначено</span></div><div><b>${pr.left}</b><span>залишилось</span></div></div>
    </div>
    <div class="list marks-list">${rows}</div>
    <div class="scr-foot">
      <button type="button" class="btn btn-primary btn-xl btn-block" data-act="gFinish" data-cat="${esc(catId)}"${pr.can ? '' : ' disabled'}>${icon('check')}Завершити перевірку</button>
      <p class="hint">${pr.can ? 'Усі предмети позначено. Запис зʼявиться в історії окремо.' : `Позначте ще ${L.count(pr.left, ['предмет', 'предмети', 'предметів'])} — інакше результат не відобразить реальний стан.`}</p>
    </div>
  </div>`;
}

function resultHtml(app, check) {
  const c = G.catMeta(app.state.gear, check.cat);
  const sum = G.summaryOf(check);
  const issues = G.checkIssues(check);
  const next = queue && queue.i + 1 < queue.cats.length ? queue.cats[queue.i + 1] : '';
  return `<div class="scr">
    <header class="scr-head"><span></span><span class="scr-head-t">Результат</span><button type="button" class="link strong" data-act="gCheckClose">Готово</button></header>
    <div class="result-card" data-r="${sum.clean ? 'done' : 'partial'}">
      <span class="big-check${sum.clean ? '' : ' partial'}">${icon(sum.clean ? 'check' : 'alert')}</span>
      <h2>${sum.clean ? 'Без зауважень' : 'Є проблеми'}</h2>
      <p>${esc(c.name)}. ${esc(G.checkTypeName(check.type))}, перевірено предметів: ${sum.total}</p>
      ${issues.length ? `<ul>${issues.map((i) => `<li>${icon(i.mark === 'missing' ? 'xCircle' : i.mark === 'refill' ? 'refill' : 'alert')}<span><b>${esc(i.name)}</b>: ${esc(G.MARK[i.mark].long.toLowerCase())}${i.note ? `, ${esc(i.note)}` : ''}</span></li>`).join('')}</ul>
        <button type="button" class="btn btn-tinted btn-block" data-act="gIssueTask" data-id="${esc(check.id)}">${icon('plus')}Додати в справи</button>` : ''}
      ${next ? `<button type="button" class="btn btn-primary btn-block" data-act="gNext">${icon('arrow')}Далі: ${esc(G.catMeta(app.state.gear, next).name)}</button>
        <button type="button" class="btn btn-quiet btn-block" data-act="gCheckClose">Завершити набір</button>`
      : `<button type="button" class="btn btn-quiet btn-block" data-act="gCheckClose">Закрити</button>`}
    </div>
  </div>`;
}

function showCheck(app, catId, from) {
  screenCat = catId;
  const html = checkHtml(app, catId);
  if (screenOpen()) {
    setScreenBg('');
    updateScreen(html, { top: 0 });
  } else {
    openScreen(html, {
      label: `Перевірка: ${catName(app, catId)}`,
      from,
      onClose: () => { screenCat = ''; queue = null; app.screenTick = null; app.render(); },
    });
  }
  animateRings($('#screen'));
  app.screenTick = null;
}

async function chooseType(title) {
  return choiceSheet({
    title,
    text: 'Тип перевірки',
    options: G.CHECK_TYPES.map((t) => ({ id: t.id, label: t.name, icon: TYPE_ICON[t.id] })),
  });
}

// Почати перевірку однієї категорії.
export async function openCheckFlow(app, catId, from = null) {
  const gear = app.state.gear;
  if (!gear.cats[catId]?.items.length) { app.go('gear', catId); return; }
  queue = null;
  if (!gear.active[catId]) {
    const type = await chooseType(catName(app, catId));
    if (!type) return;
    app.commit((s) => { G.startCheck(s.gear, catId, type, Date.now()); }, { render: false });
    await new Promise((r) => setTimeout(r, 230));
  }
  if (!app.state.gear.active[catId]) return;
  showCheck(app, catId, from);
}

export function resumeCheck(app, catId, from = null) {
  if (!app.state.gear.active[catId]) { openCheckFlow(app, catId, from); return; }
  queue = null;
  showCheck(app, catId, from);
}

// Набір категорій: щоденна, перед чергуванням, щотижнева.
export function startQueue(app, type, from = null) {
  const cats = G.queueFor(app.state.gear, type);
  if (!cats.length) { toast('Немає категорій з предметами'); return; }
  queue = { type, cats, i: 0 };
  beginCat(app, cats[0], from);
}

function beginCat(app, catId, from) {
  if (!app.state.gear.active[catId]) app.commit((s) => { G.startCheck(s.gear, catId, queue?.type || 'demand', Date.now()); }, { render: false });
  showCheck(app, catId, from);
}

/* ---------- Редактори ---------- */

function openItem(app, el) {
  const catId = el.dataset.cat || app.route.sub;
  const data = app.state.gear.cats[catId];
  if (!data) return;
  const isNew = el.dataset.id === 'new';
  const i = isNew ? { id: 'new', name: '', qty: 1, critical: false, exp: '', note: '', owner: catId === 'issued' ? 'issued' : 'personal' } : data.items.find((x) => x.id === el.dataset.id);
  if (!i) return;
  openSheet(`<form class="sheet-form" data-submit="gItemSave" data-id="${esc(i.id)}" data-cat="${esc(catId)}" autocomplete="off">
    ${sheetHead(isNew ? 'Новий предмет' : 'Предмет', { cancel: 'Скасувати', done: 'Готово', submit: true })}
    <div class="list"><label class="row field"><input class="input-plain" name="name" value="${esc(i.name)}" placeholder="Назва предмета" maxlength="80" enterkeyhint="done" aria-label="Назва предмета"${isNew ? ' data-focus' : ''}></label></div>
    <h3 class="sub-h">Облік</h3>
    ${seg('Підзвітне чи особисте', G.OWNERS, i.owner, 'formSeg', 'owner')}
    <input type="hidden" name="owner" value="${esc(i.owner)}">
    <div class="list" style="margin-top:12px">
      <div class="row field-row"><span class="row-label">Кількість</span>${stepper('qty', i.qty, 1, 999, 'Кількість', 1, 'шт')}</div>
      <label class="row field-row"><span class="row-main"><span class="row-title">Обовʼязковий</span><span class="row-meta">Позначка ${icon('shield', 'crit')} у списку і перевірці</span></span><input type="checkbox" class="switch" name="critical"${i.critical ? ' checked' : ''}></label>
      <label class="row field-row"><span class="row-main"><span class="row-title">Термін придатності</span><span class="row-meta">Для ліків, батарей, пайків — якщо потрібно</span></span><input class="date-input" type="date" name="exp" value="${esc(i.exp)}"></label>
    </div>
    <h3 class="sub-h">Примітки</h3>
    <textarea class="textarea" name="note" rows="2" maxlength="300" placeholder="Необовʼязково. Не вносьте службові номери, якщо ділитеся копіями.">${esc(i.note)}</textarea>
    ${isNew ? '' : `<div class="row2">
      <button type="button" class="btn btn-quiet" data-act="gItemMove" data-cat="${esc(catId)}" data-id="${esc(i.id)}" data-d="-1">${icon('up')}Вище</button>
      <button type="button" class="btn btn-quiet" data-act="gItemMove" data-cat="${esc(catId)}" data-id="${esc(i.id)}" data-d="1">${icon('down')}Нижче</button>
    </div>
    <div class="stack"><button type="button" class="btn btn-danger-plain btn-block" data-act="gItemDelete" data-cat="${esc(catId)}" data-id="${esc(i.id)}">${icon('trash')}Видалити предмет</button></div>`}
  </form>`, { label: 'Предмет' });
}

function openCatEditor(app, catId = '') {
  const c = catId ? app.state.gear.custom.find((x) => x.id === catId) : { name: '', icon: 'box' };
  if (!c) return;
  openSheet(`<form class="sheet-form" data-submit="gCatSave" data-cat="${esc(catId)}" autocomplete="off">
    ${sheetHead(catId ? 'Категорія' : 'Нова категорія', { cancel: 'Скасувати', done: catId ? 'Готово' : 'Створити', submit: true })}
    <div class="list"><label class="row field"><input class="input-plain" name="name" value="${esc(c.name)}" placeholder="Наприклад: Автомобіль, Речі на чергування" maxlength="40" aria-label="Назва категорії" data-focus></label></div>
    <h3 class="sub-h">Піктограма</h3>
    <div class="chips wrap" role="radiogroup" aria-label="Піктограма">${G.CUSTOM_ICONS.map((ic) => `<button type="button" class="chip plain icon-chip" role="radio" aria-checked="${c.icon === ic}" aria-pressed="${c.icon === ic}" data-act="gCatIcon" data-v="${ic}" aria-label="${ic}">${icon(ic)}</button>`).join('')}</div>
    <input type="hidden" name="icon" value="${esc(c.icon)}">
    <p class="hint">Власна категорія — це ваш шаблон перевірки: додайте предмети, і вона зʼявиться на карті.</p>
  </form>`, { label: 'Категорія' });
}

const actions = {
  gearCat(app, el) { app.go('gear', el.dataset.id); },
  gCheck(app, el) { openCheckFlow(app, el.dataset.cat, el); },
  gResume(app, el) { resumeCheck(app, el.dataset.cat, el); },
  gQueue(app, el) { startQueue(app, el.dataset.type, el); },
  async gOther(app, el) {
    const v = await choiceSheet({
      title: 'Інша перевірка',
      options: [
        { id: 'weekly', label: 'Щотижнева', hint: 'Усі категорії з предметами по черзі', icon: 'calendar' },
        ...G.catList(app.state.gear).filter((c) => app.state.gear.cats[c.id]?.items.length).map((c) => ({ id: `cat:${c.id}`, label: `На вимогу: ${c.name}`, icon: c.icon })),
      ],
    });
    if (!v) return;
    await new Promise((r) => setTimeout(r, 230));
    if (v === 'weekly') startQueue(app, 'weekly', el);
    else {
      const cat = v.slice(4);
      queue = null;
      if (!app.state.gear.active[cat]) app.commit((s) => { G.startCheck(s.gear, cat, 'demand', Date.now()); }, { render: false });
      showCheck(app, cat, el);
    }
  },
  gCheckClose() { closeScreen(); },
  async gCheckCancel(app) {
    const cat = screenCat;
    if (!cat) return;
    const ok = await confirmSheet({ title: 'Скасувати перевірку?', text: 'Позначки цієї перевірки буде видалено. Попередні записи історії залишаться.', ok: 'Скасувати перевірку', danger: true, cancel: 'Продовжити' });
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
    animateRings($('#screen'));
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
    setScreenBg('abstract-05.webp', 'center 30%');
    updateScreen(resultHtml(app, res.check), { top: 0 });
  },
  gNext(app) {
    if (!queue) { closeScreen(); return; }
    queue.i += 1;
    const cat = queue.cats[queue.i];
    if (!cat || !app.state.gear.cats[cat]?.items.length) { closeScreen(); return; }
    beginCat(app, cat, null);
  },
  gIssueTask(app, el) {
    const check = app.state.gear.history.find((h) => h.id === el.dataset.id);
    if (!check) return;
    const issues = G.checkIssues(check);
    const sub = issues.map((i) => ({ id: L.uid(), t: `${i.name}: ${G.MARK[i.mark].long.toLowerCase()}${i.note ? `, ${i.note}` : ''}`.slice(0, 120), d: 0 }));
    const t = addTask(app, `Усунути проблеми: ${catName(app, check.cat)}`, 1, app.today, { sub, cat: 'work' });
    if (t) toast('Справу створено, кроки — з переліку проблем', { label: 'Відкрити', run: () => { closeScreen(); app.go('tasks'); } });
  },
  gProbTask(app) {
    const probs = G.problemList(app.state.gear).filter((p) => !p.soonOnly);
    if (!probs.length) return;
    const sub = probs.map((p) => ({ id: L.uid(), t: `${p.item.name} (${p.catName}): ${G.ITEM_ST[p.st.s].name.toLowerCase()}`.slice(0, 120), d: 0 }));
    const t = addTask(app, 'Усунути проблеми спорядження', 1, app.today, { sub, cat: 'work' });
    if (t) toast('Справу створено', { label: 'Відкрити', run: () => app.go('tasks') });
  },
  gFix(app, el) {
    const { cat, id } = el.dataset;
    app.commit((s) => G.fixIssue(s.gear, cat, id));
    haptic();
    toast('Позначено як усунуте', { label: 'Скасувати', run: () => app.commit((s) => G.unfixIssue(s.gear, cat, id)) }, 0, 'check');
  },
  gPeriod(app, el) {
    const cat = app.route.sub;
    app.commit((s) => { s.gear.cats[cat].period = +el.dataset.v; });
  },
  gDuty(app, el) {
    app.commit((s) => { s.gear.cats[el.dataset.cat].duty = el.checked; }, { render: false });
    toast(el.checked ? 'Додано до перевірки перед чергуванням' : 'Прибрано з перевірки перед чергуванням', null, 2000, 'check');
  },
  async gDefaults(app, el) {
    const cat = el.dataset.cat;
    const def = G.defaultGear().cats[cat];
    if (!def) return;
    const have = new Set(app.state.gear.cats[cat].items.map((i) => L.normTitle(i.name)));
    const missing = def.items.filter((i) => !have.has(L.normTitle(i.name)));
    if (!missing.length) { toast('Усі типові предмети вже є'); return; }
    const ok = await confirmSheet({ title: 'Додати типові предмети?', text: `Буде додано: ${missing.map((i) => i.name).join(', ')}. Ваші предмети не зміняться.`, ok: 'Додати' });
    if (!ok) return;
    app.commit((s) => { s.gear.cats[cat].items.push(...missing.map((i) => ({ ...i, addedAt: Date.now() }))); });
  },
  gCatNew(app) { openCatEditor(app, ''); },
  gCatEdit(app, el) { openCatEditor(app, el.dataset.cat); },
  gCatIcon(app, el) {
    el.parentElement.querySelectorAll('[role="radio"]').forEach((b) => { b.setAttribute('aria-checked', String(b === el)); b.setAttribute('aria-pressed', String(b === el)); });
    el.closest('form').elements.icon.value = el.dataset.v;
  },
  gCatSave(app, form) {
    const name = form.elements.name.value.trim();
    if (!name) { form.elements.name.focus(); return; }
    const ic = form.elements.icon.value;
    const cat = form.dataset.cat;
    if (cat) {
      app.commit((s) => { const c = s.gear.custom.find((x) => x.id === cat); if (c) { c.name = name.slice(0, 40); c.icon = G.CUSTOM_ICONS.includes(ic) ? ic : 'box'; } });
      closeSheet();
      return;
    }
    let id = null;
    app.commit((s) => { id = G.addCategory(s.gear, name, ic); }, { render: false });
    closeSheet();
    if (id) app.go('gear', id); else toast(`Власних категорій може бути до ${G.CUSTOM_MAX}`);
  },
  async gCatDelete(app, el) {
    const cat = el.dataset.cat;
    const c = G.catMeta(app.state.gear, cat);
    const ok = await confirmSheet({ title: `Видалити «${c.name}»?`, text: 'Предмети категорії буде видалено. Записи історії перевірок теж зникнуть.', ok: 'Видалити', danger: true });
    if (!ok) return;
    app.commit((s) => { G.removeCategory(s.gear, cat); s.gear.history = s.gear.history.filter((h) => h.cat !== cat); }, { render: false });
    app.go('gear', '', { replace: true });
  },
  gItemEdit: openItem,
  gItemSave(app, form) {
    const cat = form.dataset.cat;
    const f = form.elements;
    const name = f.name.value.trim();
    if (!name) { f.name.focus(); return; }
    const raw = { name, qty: f.qty.value, critical: f.critical.checked, exp: f.exp.value, note: f.note.value, owner: f.owner.value };
    app.commit((s) => {
      const list = s.gear.cats[cat].items;
      if (form.dataset.id === 'new') list.push(G.cleanItem(raw, Date.now(), cat));
      else {
        const it = list.find((x) => x.id === form.dataset.id);
        if (it) Object.assign(it, G.cleanItem({ ...raw, id: it.id, addedAt: it.addedAt }, Date.now(), cat));
      }
    });
    closeSheet();
    toast('Збережено', null, 1600, 'check');
  },
  gItemMove(app, el) {
    const cat = el.dataset.cat;
    app.commit((s) => { s.gear.cats[cat].items = L.moveItem(s.gear.cats[cat].items, el.dataset.id, +el.dataset.d); });
  },
  gItemDelete(app, el) {
    const cat = el.dataset.cat;
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
  backdrop,
  actions,
  validSub: (app, sub) => (sub === 'history' || app.state.gear.cats[sub] ? sub : ''),
};
