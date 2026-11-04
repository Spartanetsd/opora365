// ОПОРА 365 — «Мої інструменти»: Personal Launcher. Сітка великих іконок, улюблені, категорії, пошук.
// Посилання перевіряються: недійсні показуються сірими і не відкриваються як робочі.
import * as L from './logic.js';
import * as D from './logic-deck.js';
import { $, esc, icon, openSheet, closeSheet, confirmSheet, toast, sheetHead, haptic } from './ui.js';
import { emptyState } from './components.js';
import { switcher } from './view-deck.js';

function tile(t, editing) {
  const v = D.checkUrl(t.url);
  const inner = t.icon ? icon(t.icon) : esc(D.glyphOf(t));
  const ic = `<span class="app-ic" data-tone="${t.tone}">${inner}${t.fav ? `<span class="app-fav" aria-hidden="true">${icon('star')}</span>` : ''}</span>`;
  const name = `<span class="app-name">${esc(t.title)}</span>`;
  if (editing || !v.ok) {
    const label = v.ok ? `Змінити: ${t.title}` : `${t.title}: недійсне посилання. Змінити`;
    return `<button type="button" class="app${v.ok ? '' : ' invalid'}" data-act="toolEdit" data-id="${esc(t.id)}" aria-label="${esc(label)}">${ic}${name}</button>`;
  }
  return `<a class="app" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer" data-act="toolOpen" data-id="${esc(t.id)}" aria-label="${esc(t.title)} — відкрити ${esc(D.toolHost(v.url))}">${ic}${name}</a>`;
}

function grid(app) {
  const ui = app.ui;
  const v = D.toolView(app.state.tools, ui.toolQ, ui.toolCat);
  const add = `<button type="button" class="app app-add" data-act="toolEdit" data-id="new" aria-label="Додати інструмент"><span class="app-ic">${icon('plus')}</span><span class="app-name">Додати</span></button>`;
  if (!app.state.tools.length) {
    return emptyState({ ic: 'apps', title: 'Каталог порожній', text: 'Додайте сайти й застосунки, якими користуєтесь щодня: вони відкриватимуться одним дотиком.', action: `<button type="button" class="btn btn-primary" data-act="toolEdit" data-id="new">${icon('plus')}Додати інструмент</button>` });
  }
  if (!v.count) return `${emptyState({ ic: 'search', title: 'Нічого не знайдено', text: 'Змініть запит або категорію.' })}`;
  const blocks = [];
  if (v.fav.length && !ui.toolCat) blocks.push(`<div class="launch-group"><p class="sub-h" style="margin-top:4px">Улюблені</p><div class="launch">${v.fav.map((t) => tile(t, ui.toolEdit)).join('')}</div></div>`);
  for (const g of v.groups) blocks.push(`<div class="launch-group"><p class="sub-h">${esc(g.name)}</p><div class="launch">${g.items.map((t) => tile(t, ui.toolEdit)).join('')}</div></div>`);
  blocks.push(`<div class="launch-group"><div class="launch">${add}</div></div>`);
  return blocks.join('');
}

function render(app) {
  const ui = app.ui;
  const used = new Set(app.state.tools.map((t) => t.cat));
  const cats = D.TOOL_CATS.filter((c) => used.has(c.id));
  return `<div class="page">
    <h1 class="large-title" data-title-anchor>Інструменти</h1>
    ${switcher('tools')}
    <p class="page-sub">Ваші сервіси й застосунки — відкриваються одним дотиком</p>
    <label class="search">${icon('search')}<input id="toolSearch" type="search" placeholder="Пошук" value="${esc(ui.toolQ)}" data-input="toolSearch" enterkeyhint="search" aria-label="Пошук інструментів" autocomplete="off"></label>
    ${cats.length > 1 ? `<div class="chips" role="radiogroup" aria-label="Категорії" style="margin-top:12px">
      <button type="button" class="chip plain" role="radio" aria-checked="${!ui.toolCat}" aria-pressed="${!ui.toolCat}" data-act="toolCat" data-v="">Усі</button>
      ${cats.map((c) => `<button type="button" class="chip plain" role="radio" aria-checked="${ui.toolCat === c.id}" aria-pressed="${ui.toolCat === c.id}" data-act="toolCat" data-v="${c.id}">${esc(c.name)}</button>`).join('')}
    </div>` : ''}
    <div id="toolsGrid" class="${ui.toolEdit ? 'editing' : ''}" style="margin-top:14px">${grid(app)}</div>
    <p class="foot">${ui.toolEdit ? 'Режим зміни: торкніться іконки, щоб змінити або видалити.' : 'Посилання відкриваються в браузері. Недійсні — сірі й не відкриваються. Для роботи сайтів потрібен інтернет.'}</p>
  </div>`;
}

function chrome(app) {
  return { right: `<button type="button" class="icon-btn tool-edit-toggle${app.ui.toolEdit ? ' on' : ''}" data-act="toolEditMode" aria-pressed="${app.ui.toolEdit}" aria-label="${app.ui.toolEdit ? 'Завершити зміну' : 'Змінити інструменти'}">${icon(app.ui.toolEdit ? 'check' : 'edit')}</button>` };
}

/* ---------- Редактор ---------- */

const ICON_NAMES = { calendar: 'Календар', mail: 'Пошта', folder: 'Папка', file: 'Документ', code: 'Код', globe: 'Сайт', chat: 'Повідомлення', map: 'Карта', alert: 'Увага', phone: 'Телефон', book: 'Книга', briefcase: 'Робота', heart: 'Здоровʼя', radio: 'Звʼязок', shield: 'Захист' };

function urlState(url) {
  if (!url.trim()) return '<p class="url-state" id="urlState">Підтримуються адреси сайтів, mailto: і tel:</p>';
  const v = D.checkUrl(url);
  return v.ok
    ? `<p class="url-state" id="urlState" data-ok="true">${icon('checkCircle')}Відкриватиметься: ${esc(D.toolHost(v.url) || v.url)}</p>`
    : `<p class="url-state" id="urlState" data-ok="false">${icon('alertCircle')}${esc(v.error)}</p>`;
}

function openEditor(app, id) {
  const isNew = id === 'new';
  const t = isNew ? { id: 'new', title: '', url: '', cat: 'svc', tone: 'blue', fav: false, glyph: '', icon: '' } : app.state.tools.find((x) => x.id === id);
  if (!t) return;
  openSheet(`<form class="sheet-form" data-submit="toolSave" data-id="${esc(t.id)}" autocomplete="off">
    ${sheetHead(isNew ? 'Новий інструмент' : 'Інструмент', { cancel: 'Скасувати', done: 'Готово', submit: true })}
    <div class="preview-ic"><span class="app" style="pointer-events:none"><span class="app-ic" data-tone="${t.tone}" id="toolPrev">${t.icon ? icon(t.icon) : esc(D.glyphOf({ title: t.title || '?', glyph: t.glyph }))}</span></span></div>
    <div class="list">
      <label class="row field"><input class="input-plain" name="title" value="${esc(t.title)}" placeholder="Назва" maxlength="40" aria-label="Назва" data-input="toolPrev"${isNew ? ' data-focus' : ''}></label>
      <label class="row field"><input class="input-plain" name="url" value="${esc(t.url)}" placeholder="Адреса: example.com, tel:+380…" maxlength="2000" inputmode="url" autocapitalize="off" spellcheck="false" aria-label="Посилання" data-input="toolUrl"></label>
      <label class="row field"><input class="input-plain" name="glyph" value="${esc(t.glyph)}" placeholder="Значок: 1–2 символи (необовʼязково)" maxlength="4" aria-label="Значок" data-input="toolPrev"></label>
    </div>
    ${urlState(t.url)}
    <h3 class="sub-h">Категорія</h3>
    <div class="chips" role="radiogroup" aria-label="Категорія">${D.TOOL_CATS.map((c) => `<button type="button" class="chip plain" role="radio" aria-checked="${t.cat === c.id}" aria-pressed="${t.cat === c.id}" data-act="toolCatPick" data-v="${c.id}">${esc(c.name)}</button>`).join('')}</div>
    <input type="hidden" name="cat" value="${esc(t.cat)}">
    <h3 class="sub-h">Піктограма</h3>
    <div class="chips icon-chips" role="radiogroup" aria-label="Піктограма">${D.TOOL_ICONS.map((ic) => `<button type="button" class="chip plain icon-chip" role="radio" aria-checked="${t.icon === ic}" aria-pressed="${t.icon === ic}" data-act="toolIcon" data-v="${ic}" aria-label="${ic ? ICON_NAMES[ic] : 'Літери з назви'}">${ic ? icon(ic) : 'Аа'}</button>`).join('')}</div>
    <input type="hidden" name="icon" value="${esc(t.icon)}">
    <h3 class="sub-h">Колір</h3>
    <div class="tones" role="radiogroup" aria-label="Колір">${D.TOOL_TONES.map((tn) => `<button type="button" class="tone-dot" data-tone="${tn}" role="radio" aria-checked="${t.tone === tn}" data-act="toolTone" data-v="${tn}" aria-label="${{ blue: 'Блакитний', teal: 'Бірюзовий', amber: 'Янтарний', coral: 'Кораловий', moon: 'Місячний', slate: 'Графітовий' }[tn]}"></button>`).join('')}</div>
    <input type="hidden" name="tone" value="${esc(t.tone)}">
    <div class="list" style="margin-top:16px"><label class="row field-row"><span class="row-main"><span class="row-title">Улюблений</span><span class="row-meta">Показувати першим</span></span><input type="checkbox" class="switch" name="fav"${t.fav ? ' checked' : ''}></label></div>
    ${isNew ? '' : `<div class="stack"><button type="button" class="btn btn-danger-plain btn-block" data-act="toolDelete" data-id="${esc(t.id)}">${icon('trash')}Видалити інструмент</button></div>`}
  </form>`, { label: 'Інструмент' });
}

const actions = {
  toolOpen(app, el) {
    const t = app.state.tools.find((x) => x.id === el.dataset.id);
    if (!t) return;
    haptic();
    app.commit(() => { t.usedAt = Date.now(); }, { render: false });
  },
  toolSearch(app, el) {
    app.ui.toolQ = el.value.slice(0, 60);
    const g = $('#toolsGrid');
    if (g) g.innerHTML = grid(app);
  },
  toolCat(app, el) { app.ui.toolCat = el.dataset.v; app.render(); },
  toolEditMode(app) { app.ui.toolEdit = !app.ui.toolEdit; app.render(); },
  toolEdit(app, el) { openEditor(app, el.dataset.id); },
  toolUrl(app, el) {
    const st = $('#urlState');
    if (st) st.outerHTML = urlState(el.value);
  },
  toolPrev(app, el) {
    const f = el.closest('form').elements;
    const p = $('#toolPrev');
    if (!p) return;
    if (f.icon.value) p.innerHTML = icon(f.icon.value);
    else p.textContent = D.glyphOf({ title: f.title.value || '?', glyph: [...f.glyph.value.trim()].slice(0, 2).join('') });
  },
  toolIcon(app, el) {
    el.parentElement.querySelectorAll('[role="radio"]').forEach((b) => { b.setAttribute('aria-checked', String(b === el)); b.setAttribute('aria-pressed', String(b === el)); });
    const form = el.closest('form');
    form.elements.icon.value = el.dataset.v;
    actions.toolPrev(app, form.elements.title);
  },
  toolCatPick(app, el) {
    el.parentElement.querySelectorAll('[role="radio"]').forEach((b) => { b.setAttribute('aria-checked', String(b === el)); b.setAttribute('aria-pressed', String(b === el)); });
    el.closest('form').elements.cat.value = el.dataset.v;
  },
  toolTone(app, el) {
    el.parentElement.querySelectorAll('[role="radio"]').forEach((b) => b.setAttribute('aria-checked', String(b === el)));
    el.closest('form').elements.tone.value = el.dataset.v;
    const p = $('#toolPrev');
    if (p) p.dataset.tone = el.dataset.v;
  },
  toolSave(app, form) {
    const f = form.elements;
    const title = f.title.value.trim().slice(0, 40);
    if (!title) { f.title.focus(); return; }
    const v = D.checkUrl(f.url.value);
    if (!v.ok) { toast(v.error); f.url.focus(); return; }
    const data = {
      title,
      url: v.url,
      cat: D.TOOL_CATS.some((c) => c.id === f.cat.value) ? f.cat.value : 'other',
      tone: D.TOOL_TONES.includes(f.tone.value) ? f.tone.value : 'blue',
      glyph: [...f.glyph.value.trim()].slice(0, 2).join(''),
      icon: D.TOOL_ICONS.includes(f.icon.value) ? f.icon.value : '',
      fav: f.fav.checked,
    };
    const id = form.dataset.id;
    app.commit((s) => {
      if (id === 'new') s.tools.push({ id: L.uid(), ...data, createdAt: Date.now(), usedAt: 0 });
      else Object.assign(s.tools.find((x) => x.id === id) || {}, data);
    });
    closeSheet();
    toast(id === 'new' ? 'Інструмент додано' : 'Збережено');
  },
  async toolDelete(app, el) {
    const t = app.state.tools.find((x) => x.id === el.dataset.id);
    if (!t) return;
    const ok = await confirmSheet({ title: `Видалити «${t.title}»?`, ok: 'Видалити', danger: true });
    if (!ok) return;
    const i = app.state.tools.indexOf(t);
    app.commit((s) => { s.tools = s.tools.filter((x) => x !== t); });
    toast('Інструмент видалено', { label: 'Скасувати', run: () => app.commit((s) => { s.tools.splice(i, 0, t); }) });
  },
};

export default { title: 'Інструменти', render, chrome, actions };
