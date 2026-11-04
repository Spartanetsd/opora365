// ОПОРА — налаштування, резервні копії та пояснення обмежень.
import * as L from './logic.js';
import * as store from './store.js';
import { $, esc, icon, seg, openSheet, sheetHead, confirmSheet, toast } from './ui.js';

function when(ts, today) {
  if (!ts) return 'ще не створювалась';
  const days = L.diffDays(L.todayKey(ts), today);
  const time = L.fmtHM(L.kyivParts(ts).min);
  if (days <= 0) return `сьогодні о ${time}`;
  if (days === 1) return `учора о ${time}`;
  return `${L.daysWord(days)} тому`;
}

function html(app) {
  const s = app.state.settings;
  const sum = L.overview(app.state);
  const stale = !s.lastBackupAt || L.diffDays(L.todayKey(s.lastBackupAt), app.today) > 7;
  return `${sheetHead('Налаштування')}
  <h3 class="sub-h">Оформлення</h3>
  ${seg('Тема', [{ id: 'auto', name: 'Як у системі' }, { id: 'light', name: 'Світла' }, { id: 'dark', name: 'Темна' }], s.theme, 'setTheme')}

  <h3 class="sub-h">Дані на цьому пристрої</h3>
  <div class="list">
    <div class="row info-row"><span class="row-label">Справи у роботі</span><span class="row-value">${sum.tasks}</span></div>
    <div class="row info-row"><span class="row-label">Обов’язкові</span><span class="row-value">${sum.musts}</span></div>
    <div class="row info-row"><span class="row-label">Постійне сховище</span><span class="row-value" id="persistState">перевіряю…</span></div>
    <div class="row info-row"><span class="row-label">Резервна копія</span><span class="row-value${stale ? ' warn' : ''}">${when(s.lastBackupAt, app.today)}</span></div>
  </div>
  <div class="list">
    <button type="button" class="row row-btn" data-act="backupExport">${icon('share')}<span>Створити резервну копію</span></button>
    <button type="button" class="row row-btn" data-act="backupCheck">${icon('filecheck')}<span>Перевірити резервну копію</span></button>
    <button type="button" class="row row-btn" data-act="backupImport">${icon('import')}<span>Відновити з копії</span></button>
  </div>
  <div id="backupResult" aria-live="polite"></div>
  <p class="foot">Усе зберігається лише локально: без хмари, входу й передавання в мережу. Якщо видалити іконку з початкового екрана, iOS зітре й дані — тому періодично зберігайте копію у «Файли».</p>

  <h3 class="sub-h">Нагадування</h3>
  <p class="foot">Вебзастосунок не може сам надіслати сповіщення, коли він закритий. Щоб не проспати: «Команди» → «Автоматизація» → «Час доби» (ваш час підйому) → «Запускати одразу» → дія «Показати сповіщення» з текстом «Відкрий ОПОРА». Відкривайте застосунок з іконки: посилання з «Команд» відкривається в Safari, де інше сховище.</p>

  <div class="list"><button type="button" class="row row-btn danger" data-act="wipeAll">${icon('trash')}<span>Стерти всі дані</span></button></div>
  <p class="foot center">ОПОРА · Мій день · версія ${esc(app.version)}<br>Часовий пояс: ${esc(L.TIME_AREA)}</p>`;
}

function openSettings(app) {
  openSheet(html(app));
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
  const made = r.exportedAt ? when(r.exportedAt, app.today) : 'невідомо коли';
  return `<b>Копія справна.</b> Створена ${made}.<br>
    У копії: справ ${r.summary.tasks} (зараз ${cur.tasks}), обов’язкових ${r.summary.musts} (зараз ${cur.musts}), кроків ранку ${r.summary.steps}, прибуття ${esc(r.summary.arrival)}.${r.dropped ? `<br>Пошкоджених записів пропущено: ${r.dropped}.` : ''}`;
}

const actions = {
  openSettings,
  setTheme(app, el) {
    el.closest('.seg').querySelectorAll('[role="radio"]').forEach((b) => b.setAttribute('aria-checked', String(b === el)));
    app.commit((s) => { s.settings.theme = el.dataset.v; });
    app.applyTheme();
  },
  backupExport(app) {
    const now = Date.now();
    const name = `opora-kopiia-${app.today}.json`;
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
      text: `Поточні дані (справ ${cur.tasks}, обов’язкових ${cur.musts}) буде замінено даними з копії (справ ${r.summary.tasks}, обов’язкових ${r.summary.musts}). Одразу після відновлення можна повернути попередній стан.`,
      ok: 'Відновити',
      danger: true,
    });
    if (!ok) return;
    store.keepBeforeImport(app.state);
    app.state = r.state;
    app.state.session = null;
    store.save(app.state);
    app.applyTheme();
    app.render();
    toast('Дані відновлено з копії', {
      label: 'Повернути',
      run: () => {
        const prev = store.takeBeforeImport();
        if (!prev) return;
        app.state = prev;
        store.save(prev);
        app.applyTheme();
        app.render();
        toast('Попередні дані повернуто');
      },
    }, 10000);
  },
  async wipeAll(app) {
    const ok = await confirmSheet({
      title: 'Стерти всі дані?',
      text: 'Буде видалено справи, обов’язкові справи й налаштування ранку на цьому пристрої. Відновити можна лише з резервної копії.',
      ok: 'Стерти все',
      danger: true,
    });
    if (!ok) return;
    await store.wipe();
    app.state = L.defaultState();
    store.save(app.state);
    app.applyTheme();
    app.go('today');
    toast('Усі дані стерто');
  },
};

export default { actions };
