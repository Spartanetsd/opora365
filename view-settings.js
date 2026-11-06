// ОПОРА 365 — компактне меню, налаштування, резервні копії, оновлення і чесне пояснення обмежень iOS.
import * as L from './logic.js';
import * as store from './store.js';
import { $, esc, icon, seg, openSheet, closeSheet, sheetHead, confirmSheet, toast, setHaptics } from './ui.js';
import { openEvening } from './view-evening.js';

/* ---------- Меню ---------- */

export function openMenu(app) {
  const mi = L.modeInfo(app.state);
  const tpl = L.currentTpl(app.state);
  const tv = L.taskView(app.state.tasks, app.today);
  const theme = { dark: 'темна', light: 'світла', auto: 'як у системі' }[app.state.settings.theme];
  const row = (act, ic, title, meta = '', extra = '') => `<button type="button" class="row row-btn" data-act="${act}"${extra}>
    <span class="row-ic">${icon(ic)}</span>
    <span class="row-main"><span class="row-title">${title}</span>${meta ? `<span class="row-meta">${esc(meta)}</span>` : ''}</span>
    ${icon('chev', 'row-chev')}
  </button>`;
  openSheet(`${sheetHead('Меню')}
    <div class="list menu-list">
      ${row('menuGo', 'sunrise', 'Мій ранок', `${tpl.name}, підйом о ${L.fmtHM(L.computePlan(tpl).wake)}`, ' data-tab="morning"')}
      ${row('menuGo', 'list', 'Усі справи', `Пошук, без дати, архів. У роботі: ${tv.openCount + tv.upcoming.length + tv.nodate.length}`, ' data-tab="tasks"')}
      ${row('menuEvening', 'moon', 'Вечірній підсумок', 'Зроблене, перенесення, головне на завтра')}
      ${row('menuGo', 'chart', 'Підсумки тижня', 'Лише факти, без оцінок', ' data-tab="stats"')}
      ${row('menuGo', 'apps', 'Інструменти', `Сайти й застосунки: ${app.state.tools.length}`, ' data-tab="tools"')}
    </div>
    <div class="list menu-list">
      ${row('openMode', L.MODE[mi.id].icon, 'Режим дня', `${L.MODE[mi.id].name}${mi.manual ? ', вручну' : ', автоматично'}`)}
      ${row('openSettings', 'gear', 'Налаштування', `Тема: ${theme}. Імʼя, вечір, відгук`)}
      ${row('openBackup', 'share', 'Резервні копії', app.state.settings.lastBackupAt ? `Остання: ${L.whenText(app.state.settings.lastBackupAt, app.today)}` : 'Копій ще не було')}
    </div>
    <p class="foot center">ОПОРА 365, версія ${esc(app.version)}. Obsidian Clarity</p>`, { label: 'Меню' });
}

/* ---------- Налаштування ---------- */

function settingsHtml(app) {
  const s = app.state.settings;
  return `${sheetHead('Налаштування')}
  <h3 class="sub-h">Оформлення</h3>
  ${seg('Тема', [{ id: 'dark', name: 'Темна' }, { id: 'light', name: 'Світла' }, { id: 'auto', name: 'Як у системі' }], s.theme, 'setTheme')}
  <p class="hint">Колір рядка стану iPhone оновиться після перезапуску застосунку з іконки.</p>

  <h3 class="sub-h">Особисте</h3>
  <div class="list">
    <label class="row field-row"><span class="row-main"><span class="row-title">Звертання</span><span class="row-meta">У привітанні, у кличному відмінку</span></span><input class="input-plain" style="text-align:right;max-width:45%" id="nameInput" value="${esc(s.name)}" maxlength="40" placeholder="Імʼя" data-change="setName" aria-label="Як до вас звертатися"></label>
    <label class="row field-row"><span class="row-main"><span class="row-title">Вечір з</span><span class="row-meta">Режим «Вечір»: підсумок дня і план на завтра</span></span><input class="time-input" type="time" value="${esc(s.eveningAt)}" data-change="setEveningAt" aria-label="Час початку вечора"></label>
    <label class="row field-row"><span class="row-main"><span class="row-title">Відпочинок з</span><span class="row-meta">До ранку — лише найважливіше</span></span><input class="time-input" type="time" value="${esc(s.restAt)}" data-change="setRestAt" aria-label="Час початку відпочинку"></label>
    <label class="row field-row"><span class="row-main"><span class="row-title">Тактильний відгук</span><span class="row-meta">Лише там, де його підтримує платформа. Звуків немає</span></span><input type="checkbox" class="switch" data-change="setHaptic"${s.haptics ? ' checked' : ''}></label>
  </div>

  <h3 class="sub-h">Нагадування</h3>
  <div class="note-card">
    <span class="note-ic" aria-hidden="true">${icon('info')}</span>
    <div class="note-body">
      <p class="note-t">Нагадування видно, коли застосунок відкритий</p>
      <p>Коли він закритий, сповіщень немає: для них потрібен сервер, якого тут свідомо немає.</p>
      <details class="how">
        <summary>Як не проспати: «Команди» на iPhone${icon('down')}</summary>
        <p>«Команди» → «Автоматизація» → «+» → «Час доби» (ваш час підйому) → «Запускати одразу» → дія «Показати сповіщення» з текстом «Відкрий ОПОРА».</p>
      </details>
    </div>
  </div>

  <h3 class="sub-h">Застосунок</h3>
  <div class="list">
    <button type="button" class="row row-btn" data-act="checkUpdate">${icon('reset')}<span class="row-main"><span class="row-title">Перевірити оновлення</span><span class="row-meta" id="updState">Версія ${esc(app.version)}. Працює офлайн після першого запуску</span></span></button>
    <button type="button" class="row row-btn" data-act="welcomeAgain">${icon('sun')}<span>Вітальний екран</span></button>
    <a class="row row-btn" href="tests.html" target="_blank" rel="noopener">${icon('checkCircle')}<span>Тести логіки в цьому браузері</span></a>
    <button type="button" class="row row-btn danger" data-act="wipeAll">${icon('trash')}<span>Стерти всі дані</span></button>
  </div>
  <p class="foot center">ОПОРА 365, версія ${esc(app.version)}. Obsidian Clarity<br>Часовий пояс: ${esc(L.TIME_AREA)}</p>`;
}

function backupHtml(app) {
  const s = app.state.settings;
  const sum = L.overview(app.state);
  const stale = !s.lastBackupAt || L.diffDays(L.todayKey(s.lastBackupAt), app.today) > 7;
  return `${sheetHead('Резервні копії')}
  <h3 class="sub-h">Дані на цьому пристрої</h3>
  <div class="list">
    <div class="row"><span class="row-label">Справи в роботі / в архіві</span><span class="row-value">${sum.tasks} / ${sum.tasksDone}</span></div>
    <div class="row"><span class="row-label">«Не забути»</span><span class="row-value">${sum.musts}</span></div>
    <div class="row"><span class="row-label">Шаблони ранку</span><span class="row-value">${sum.templates}</span></div>
    <div class="row"><span class="row-label">Предмети / перевірки</span><span class="row-value">${sum.items} / ${sum.checks}</span></div>
    <div class="row"><span class="row-label">Сценарії / інструменти</span><span class="row-value">${sum.scenarios} / ${sum.tools}</span></div>
    <div class="row"><span class="row-label">Постійне сховище</span><span class="row-value" id="persistState">перевіряю…</span></div>
    <div class="row"><span class="row-label">Резервна копія</span><span class="row-value${stale ? ' warn' : ''}">${s.lastBackupAt ? L.whenText(s.lastBackupAt, app.today) : 'ще не створювалась'}</span></div>
  </div>
  <div class="list">
    <button type="button" class="row row-btn" data-act="backupExport">${icon('share')}<span>Створити резервну копію</span></button>
    <button type="button" class="row row-btn" data-act="backupCheck">${icon('filecheck')}<span>Перевірити резервну копію</span></button>
    <button type="button" class="row row-btn" data-act="backupImport">${icon('import')}<span>Відновити з копії</span></button>
    ${store.status.hasPrev ? `<button type="button" class="row row-btn" data-act="exportPrev">${icon('history')}<span class="row-main"><span class="row-title">Дані до оновлення</span><span class="row-meta">Збережено як є перед переходом на нову версію</span></span></button>` : ''}
  </div>
  <div id="backupResult" aria-live="polite"></div>
  <p class="foot">Усе зберігається лише локально: без хмари, входу й передавання в мережу. Якщо видалити іконку з початкового екрана, iOS зітре й дані — періодично зберігайте копію у «Файли». Не викладайте копію в публічний репозиторій.</p>`;
}

function persistCheck() {
  store.persistence(false).then((v) => {
    const el = $('#persistState');
    if (!el) return;
    el.textContent = v === true ? 'увімкнено' : v === false ? 'не підтверджено' : 'недоступно';
    el.classList.toggle('warn', v !== true);
  });
}

export function openSettings(app, part = '') {
  if (part === 'backup') { openSheet(backupHtml(app), { label: 'Резервні копії' }); persistCheck(); return; }
  openSheet(settingsHtml(app), { label: 'Налаштування' });
}

function result(message, tone) {
  const el = $('#backupResult');
  if (el) el.innerHTML = `<div class="result" data-tone="${tone}">${icon(tone === 'ok' ? 'check' : 'alert')}<p>${message}</p></div>`;
}

async function readPicked() {
  const file = await store.pickFile();
  if (!file) return null;
  try {
    return { file, r: L.readBackup(await store.readJSON(file)) };
  } catch (e) {
    return { file, r: { ok: false, error: e?.message?.includes('завеликий') ? e.message : 'Файл пошкоджений або не є резервною копією (JSON).' } };
  }
}

function describe(r, app) {
  const cur = L.overview(app.state);
  const made = r.exportedAt ? L.whenText(r.exportedAt, app.today) : 'невідомо коли';
  return `<b>Копія справна.</b> Створена ${made}${r.from < L.SCHEMA ? ' попередньою версією (буде перенесена без втрат)' : ''}.<br>
    У копії: справ ${r.summary.tasks} (зараз ${cur.tasks}), «Не забути» ${r.summary.musts} (зараз ${cur.musts}), предметів ${r.summary.items}, перевірок ${r.summary.checks}, інструментів ${r.summary.tools}, шаблонів ранку ${r.summary.templates}.${r.dropped ? `<br>Пошкоджених записів пропущено: ${r.dropped}.` : ''}`;
}

const actions = {
  openSettings(app) { openSettings(app); },
  openBackup(app) { openSettings(app, 'backup'); },
  menuGo(app, el) {
    closeSheet();
    app.go(el.dataset.tab, el.dataset.sub || '');
  },
  menuEvening(app) {
    closeSheet();
    setTimeout(() => openEvening(app), 210);
  },
  setTheme(app, el) {
    el.closest('.seg').querySelectorAll('[role="radio"]').forEach((b) => b.setAttribute('aria-checked', String(b === el)));
    app.commit((s) => { s.settings.theme = el.dataset.v; }, { render: false });
    app.applyTheme();
    app.render();
  },
  setName(app, el) {
    app.commit((s) => { s.settings.name = el.value.trim().slice(0, 40); }, { render: false });
    toast('Збережено', null, 1600, 'check');
  },
  // Значення видно в самому полі; повідомлення на кожен оберт колеса вибору лише заважало б.
  setEveningAt(app, el) {
    const v = L.parseHM(el.value);
    if (v == null) return;
    app.commit((s) => { s.settings.eveningAt = L.fmtHM(v); }, { render: false });
  },
  setRestAt(app, el) {
    const v = L.parseHM(el.value);
    if (v == null) return;
    app.commit((s) => { s.settings.restAt = L.fmtHM(v); }, { render: false });
  },
  setHaptic(app, el) {
    app.commit((s) => { s.settings.haptics = el.checked; }, { render: false });
    setHaptics(el.checked);
  },
  backupExport(app) {
    const now = Date.now();
    const name = `opora365-kopiia-${app.today}.json`;
    const text = JSON.stringify(L.makeBackup(app.state, now), null, 1);
    store.shareFile(name, text).then((how) => {
      if (how === 'cancelled') return;
      app.commit((s) => { s.settings.lastBackupAt = now; }, { render: false });
      openSettings(app, 'backup');
      result(`Копію «${esc(name)}» створено. Збережіть її у «Файли», а потім перевірте кнопкою «Перевірити резервну копію».`, 'ok');
    });
  },
  async backupCheck(app) {
    const picked = await readPicked();
    if (!picked) return;
    const { r } = picked;
    if (!r.ok) { result(esc(r.error), 'bad'); return; }
    result(describe(r, app), 'ok');
  },
  async backupImport(app) {
    const picked = await readPicked();
    if (!picked) return;
    const { r } = picked;
    if (!r.ok) { result(esc(r.error), 'bad'); return; }
    const cur = L.overview(app.state);
    const ok = await confirmSheet({
      title: 'Відновити дані з копії?',
      text: `Поточні дані (справ ${cur.tasks}, «Не забути» ${cur.musts}, перевірок ${cur.checks}) буде замінено даними з копії (справ ${r.summary.tasks}, «Не забути» ${r.summary.musts}, перевірок ${r.summary.checks}). Одразу після відновлення можна повернути попередній стан.`,
      ok: 'Відновити',
      danger: true,
    });
    if (!ok) return;
    store.keepBeforeImport(app.state);
    app.state = r.state;
    app.state.session = null;
    app.state.settings.onboarded = true;
    store.save(app.state);
    app.applyTheme();
    app.applyMode();
    app.render();
    toast('Дані відновлено з копії', {
      label: 'Повернути',
      run: () => {
        const prev = store.takeBeforeImport();
        if (!prev) return;
        app.state = prev;
        store.save(prev);
        app.applyTheme();
        app.applyMode();
        app.render();
        toast('Попередні дані повернуто');
      },
    }, 10000);
  },
  async exportPrev(app) {
    const prev = await store.previousData();
    if (!prev) { toast('Копії даних до оновлення немає'); return; }
    const data = prev.data || prev;
    const text = JSON.stringify({ app: 'opora', kind: 'backup', v: Number(data.v) || 1, exportedAt: prev.savedAt || Date.now(), data }, null, 1);
    const how = await store.shareFile(`opora-do-onovlennia-${app.today}.json`, text);
    if (how !== 'cancelled') result('Файл із даними попередньої версії створено. Його можна перевірити й відновити тут же.', 'ok');
  },
  async checkUpdate(app) {
    const el = $('#updState');
    if (el) el.textContent = 'Перевіряю…';
    const r = await app.checkUpdate(true);
    const text = { found: 'Знайдено нову версію — зʼявиться кнопка «Оновити»', latest: `У вас остання версія ${app.version}`, offline: 'Немає звʼязку — перевірте пізніше', none: 'Оновлення доступні після встановлення з GitHub Pages' }[r] || '';
    if (el) el.textContent = text;
  },
  async wipeAll(app) {
    const ok = await confirmSheet({
      title: 'Стерти всі дані?',
      text: 'Буде видалено справи, «Не забути», шаблони ранку, спорядження з історією перевірок, сценарії, інструменти й налаштування на цьому пристрої. Відновити можна лише з резервної копії.',
      ok: 'Стерти все',
      danger: true,
    });
    if (!ok) return;
    await store.wipe();
    app.state = L.defaultState();
    app.state.settings.onboarded = true;
    store.save(app.state);
    app.applyTheme();
    app.applyMode();
    app.go('home');
    toast('Усі дані стерто');
  },
};

export default { actions };
