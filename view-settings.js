// ОПОРА 365 — налаштування, резервні копії, оновлення і чесне пояснення обмежень iOS.
import * as L from './logic.js';
import * as store from './store.js';
import { $, esc, icon, seg, openSheet, sheetHead, confirmSheet, toast, setHaptics } from './ui.js';

function html(app) {
  const s = app.state.settings;
  const sum = L.overview(app.state);
  const stale = !s.lastBackupAt || L.diffDays(L.todayKey(s.lastBackupAt), app.today) > 7;
  return `${sheetHead('Налаштування')}
  <h3 class="sub-h">Оформлення</h3>
  ${seg('Тема', [{ id: 'dark', name: 'Obsidian' }, { id: 'light', name: 'Daylight' }, { id: 'auto', name: 'Як у системі' }], s.theme, 'setTheme')}
  <p class="hint">Колір рядка стану iPhone оновиться після перезапуску застосунку з іконки.</p>

  <h3 class="sub-h">Особисте</h3>
  <div class="list">
    <label class="row field-row"><span class="row-main"><span class="row-title">Звертання</span><span class="row-meta">У привітанні, у кличному відмінку</span></span><input class="input-plain" style="text-align:right;max-width:45%" id="nameInput" value="${esc(s.name)}" maxlength="40" placeholder="Імʼя" data-change="setName" aria-label="Як до вас звертатися"></label>
    <label class="row field-row"><span class="row-main"><span class="row-title">Відпочинок з</span><span class="row-meta">Автоматичний режим увечері</span></span><input class="time-input" type="time" value="${esc(s.restAt)}" data-change="setRestAt" aria-label="Час початку режиму «Відпочинок»"></label>
    <label class="row field-row"><span class="row-main"><span class="row-title">Тактильний відгук</span><span class="row-meta">Лише там, де його підтримує платформа</span></span><input type="checkbox" class="switch" data-change="setHaptic"${s.haptics ? ' checked' : ''}></label>
  </div>

  <h3 class="sub-h">Дані на цьому пристрої</h3>
  <div class="list">
    <div class="row"><span class="row-label">Справи у роботі</span><span class="row-value">${sum.tasks}</span></div>
    <div class="row"><span class="row-label">Обовʼязкові</span><span class="row-value">${sum.musts}</span></div>
    <div class="row"><span class="row-label">Предмети · перевірки</span><span class="row-value">${sum.items} · ${sum.checks}</span></div>
    <div class="row"><span class="row-label">Сценарії · інструменти</span><span class="row-value">${sum.scenarios} · ${sum.tools}</span></div>
    <div class="row"><span class="row-label">Постійне сховище</span><span class="row-value" id="persistState">перевіряю…</span></div>
    <div class="row"><span class="row-label">Резервна копія</span><span class="row-value${stale ? ' warn' : ''}">${s.lastBackupAt ? L.whenText(s.lastBackupAt, app.today) : 'ще не створювалась'}</span></div>
  </div>
  <div class="list">
    <button type="button" class="row row-btn" data-act="backupExport">${icon('share')}<span>Створити резервну копію</span></button>
    <button type="button" class="row row-btn" data-act="backupCheck">${icon('filecheck')}<span>Перевірити резервну копію</span></button>
    <button type="button" class="row row-btn" data-act="backupImport">${icon('import')}<span>Відновити з копії</span></button>
    ${store.status.hasPrev ? `<button type="button" class="row row-btn" data-act="exportPrev">${icon('history')}<span class="row-main"><span class="row-title">Дані до оновлення 2.0</span><span class="row-meta">Збережено при першому запуску нової версії</span></span></button>` : ''}
  </div>
  <div id="backupResult" aria-live="polite"></div>
  <p class="foot">Усе зберігається лише локально: без хмари, входу й передавання в мережу. Якщо видалити іконку з початкового екрана, iOS зітре й дані — періодично зберігайте копію у «Файли». Копію не варто викладати в публічний репозиторій.</p>

  <h3 class="sub-h">Нагадування</h3>
  <div class="card pad">
    <p style="margin:0 0 8px;font-weight:650">Чесно про обмеження iOS</p>
    <p class="muted small" style="margin:0">Встановлений з Safari застосунок не може сам надіслати сповіщення, коли закритий: для цього потрібен сервер Web Push, якого тут свідомо немає. Нагадування всередині застосунку (наступна дія, прострочене, перевірки) працюють, коли ви його відкриваєте.</p>
    <p class="muted small" style="margin:8px 0 0">Щоб не проспати: «Команди» → «Автоматизація» → «+» → «Час доби» (ваш час підйому) → «Запускати одразу» → дія «Показати сповіщення» з текстом «Відкрий ОПОРА». Запускайте ОПОРА з іконки: посилання з «Команд» відкривається в Safari, де інше сховище.</p>
  </div>

  <h3 class="sub-h">Застосунок</h3>
  <div class="list">
    <button type="button" class="row row-btn" data-act="checkUpdate">${icon('reset')}<span class="row-main"><span class="row-title">Перевірити оновлення</span><span class="row-meta" id="updState">Версія ${esc(app.version)} · працює офлайн після першого запуску</span></span></button>
    <a class="row row-btn" href="tests.html" target="_blank" rel="noopener">${icon('checkCircle')}<span>Тести логіки в цьому браузері</span></a>
    <button type="button" class="row row-btn danger" data-act="wipeAll">${icon('trash')}<span>Стерти всі дані</span></button>
  </div>
  <p class="foot center">ОПОРА 365 · Obsidian Flow · версія ${esc(app.version)}<br>Часовий пояс: ${esc(L.TIME_AREA)}</p>`;
}

export function openSettings(app) {
  openSheet(html(app), { label: 'Налаштування' });
  store.persistence(false).then((v) => {
    const el = $('#persistState');
    if (!el) return;
    el.textContent = v === true ? 'увімкнено' : v === false ? 'не підтверджено' : 'недоступно';
    el.classList.toggle('warn', v !== true);
  });
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
    У копії: справ ${r.summary.tasks} (зараз ${cur.tasks}), обовʼязкових ${r.summary.musts} (зараз ${cur.musts}), предметів ${r.summary.items}, перевірок ${r.summary.checks}, інструментів ${r.summary.tools}, кроків ранку ${r.summary.steps}.${r.dropped ? `<br>Пошкоджених записів пропущено: ${r.dropped}.` : ''}`;
}

const actions = {
  openSettings,
  setTheme(app, el) {
    el.closest('.seg').querySelectorAll('[role="radio"]').forEach((b) => b.setAttribute('aria-checked', String(b === el)));
    app.commit((s) => { s.settings.theme = el.dataset.v; }, { render: false });
    app.applyTheme();
  },
  setName(app, el) {
    app.commit((s) => { s.settings.name = el.value.trim().slice(0, 40); }, { render: false });
    toast('Збережено');
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
      openSettings(app);
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
      text: `Поточні дані (справ ${cur.tasks}, обовʼязкових ${cur.musts}, перевірок ${cur.checks}) буде замінено даними з копії (справ ${r.summary.tasks}, обовʼязкових ${r.summary.musts}, перевірок ${r.summary.checks}). Одразу після відновлення можна повернути попередній стан.`,
      ok: 'Відновити',
      danger: true,
    });
    if (!ok) return;
    store.keepBeforeImport(app.state);
    app.state = r.state;
    app.state.session = null;
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
      text: 'Буде видалено справи, обовʼязкові, екіпірування з історією перевірок, сценарії, інструменти й налаштування на цьому пристрої. Відновити можна лише з резервної копії.',
      ok: 'Стерти все',
      danger: true,
    });
    if (!ok) return;
    await store.wipe();
    app.state = L.defaultState();
    store.save(app.state);
    app.applyTheme();
    app.applyMode();
    app.go('home');
    toast('Усі дані стерто');
  },
};

export default { actions };
