// ОПОРА — тести логіки (без бібліотек).
// Запуск: `node tests.js` (Node 18+) або відкрийте tests.html у браузері, зокрема на iPhone.
import * as L from './logic.js';
import { esc } from './ui.js';

const cases = [];
const test = (name, fn) => cases.push({ name, fn });
function eq(actual, expected, msg = '') {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg ? msg + ': ' : ''}очікувалось ${e}, отримано ${a}`);
}
function ok(value, msg = 'умова не виконана') { if (!value) throw new Error(msg); }

// Київ у листопаді — UTC+2, у липні — UTC+3.
const nov = (h, m, d = 3) => Date.UTC(2026, 10, d, h - 2, m);
const session = (startH, startM, extra = {}) => ({ date: '2026-11-03', startedAt: nov(startH, startM), done: {}, skipped: {}, checks: {}, short: false, finishedAt: 0, ...extra });

/* ---------- Час ---------- */

test('Розбір і формат часу', () => {
  eq(L.parseHM('08:30'), 510);
  eq(L.parseHM('7:05'), 425);
  eq(L.parseHM('24:00'), null);
  eq(L.parseHM('ab'), null);
  eq(L.fmtHM(-20), '23:40');
  eq(L.fmtHM(1445), '00:05');
  eq(L.fmtDur(65), '1 год 5 хв');
  eq(L.fmtDur(40), '40 хв');
  eq(L.fmtDur(120), '2 год');
});

test('Київський час: зима, літо, перехід через північ', () => {
  ok(L.TIME_AREA !== 'local', 'часовий пояс Europe/Kyiv недоступний');
  eq(L.kyivParts(Date.UTC(2026, 10, 3, 16, 22)), { date: '2026-11-03', min: 18 * 60 + 22, sec: 0 });
  eq(L.kyivParts(Date.UTC(2026, 6, 1, 5, 0)).min, 8 * 60, 'липень, UTC+3');
  eq(L.kyivParts(Date.UTC(2026, 10, 3, 22, 30)).date, '2026-11-04', 'після опівночі за Києвом');
});

test('Дати: різниця днів через перехід на зимовий час, дні тижня', () => {
  eq(L.diffDays('2026-10-24', '2026-10-26'), 2);
  eq(L.addDays('2026-12-31', 1), '2027-01-01');
  eq(L.weekday('2026-11-03'), 2);
  eq(L.longDate('2026-11-03'), 'вівторок, 3 листопада');
  eq(L.shortDate('2026-11-04', '2026-11-03'), 'завтра');
  eq(L.shortDate('2026-11-09', '2026-11-03'), 'пн, 9 лист.');
});

test('Відмінювання «день»', () => {
  eq([1, 2, 5, 11, 21, 22, 25, 112].map(L.daysWord), ['1 день', '2 дні', '5 днів', '11 днів', '21 день', '22 дні', '25 днів', '112 днів']);
});

/* ---------- Ранковий план ---------- */

test('Час виходу = прибуття − дорога − запас; підйом = вихід − кроки', () => {
  const p = L.computePlan(L.defaultState().morning);
  eq(L.fmtHM(p.departure), '07:35');
  eq(p.total, 60);
  eq(L.fmtHM(p.wake), '06:35');
  eq(p.steps.map((s) => L.fmtHM(s.start)), ['06:35', '06:40', '06:55', '07:10', '07:20', '07:25', '07:30']);
});

test('Зміна транспорту й запасу перераховує час', () => {
  const m = { ...L.defaultState().morning, transport: 'taxi', buffer: 10 };
  eq(L.fmtHM(L.computePlan(m).departure), '08:00');
});

test('Режим «Часу обмаль» не скорочує критичні перевірки', () => {
  const m = L.defaultState().morning;
  const p = L.computePlan(m, true);
  eq(p.total, 28);
  const docs = p.steps.find((s) => s.critical);
  eq(docs.dur, docs.min, 'критичний крок');
  ok(p.steps.every((s) => s.critical || s.dur <= s.min));
});

test('План, що переходить на попередню добу', () => {
  const m = { ...L.defaultState().morning, arrival: '00:20', transport: 'car', travel: { bus: 40, car: 30, taxi: 20, walk: 35 }, buffer: 10 };
  const p = L.computePlan(m);
  eq(L.fmtHM(p.departure), '23:40');
  ok(p.wakePrevDay);
});

test('План діє на сьогодні до виходу + 2 год, потім — на завтра', () => {
  const m = L.defaultState().morning;
  eq(L.planTarget(m, L.localMin(nov(7, 0))), '2026-11-03');
  eq(L.planTarget(m, L.localMin(nov(9, 30))), '2026-11-03');
  eq(L.planTarget(m, L.localMin(nov(9, 40))), '2026-11-04');
  eq(L.planTarget(m, L.localMin(nov(22, 0))), '2026-11-04');
});

test('Підготовка вчасно: запас 0 — «у графіку»', () => {
  const st = L.sessionStatus(L.defaultState(), session(6, 35), nov(6, 35));
  eq([st.level, st.remaining, st.toDep, st.spare], ['ok', 60, 60, 0]);
});

test('Поточний крок враховує вже витрачений час', () => {
  const st = L.sessionStatus(L.defaultState(), session(6, 35), nov(6, 38));
  eq(st.current.title, 'Прокинутися');
  eq([st.current.left, L.fmtHM(st.current.eta)], [2, '06:38'], 'залишок і початок поточного кроку');
  eq(st.remaining, 57);
});

test('Запізнення на 20 хв: пропонується «Часу обмаль»', () => {
  const st = L.sessionStatus(L.defaultState(), session(6, 55), nov(6, 55));
  eq([st.level, st.spare, st.altSpare], ['tight', -20, 12]);
});

test('Навіть мінімальний набір не встигає — чесний прогноз виходу', () => {
  const s = L.defaultState();
  const st = L.sessionStatus(s, session(7, 20), nov(7, 20));
  eq(st.level, 'late');
  const short = L.sessionStatus(s, session(7, 20, { short: true }), nov(7, 20));
  eq(L.fmtHM(short.expected), '07:48');
  eq(short.rows.find((r) => r.critical).dur, 5, 'критична перевірка не скорочена');
});

test('Виконані кроки зменшують залишок; усе виконано — готові', () => {
  const s = L.defaultState();
  const ids = s.morning.steps.map((x) => x.id);
  const done = { [ids[0]]: nov(6, 40), [ids[1]]: nov(6, 50), [ids[2]]: nov(6, 50) };
  const st = L.sessionStatus(s, session(6, 35, { done }), nov(6, 50));
  eq([st.current.title, st.remaining, st.level, st.doneCount], ['Особисті речі', 25, 'ok', 3]);
  const all = Object.fromEntries(ids.map((id) => [id, nov(7, 30)]));
  ok(L.sessionStatus(s, session(6, 35, { done: all }), nov(7, 30)).finished);
});

test('Сесія ранку застаріває через 2 год після виходу', () => {
  const s = L.defaultState();
  s.session = session(6, 35);
  ok(L.activeSession(s, L.localMin(nov(9, 30))));
  eq(L.activeSession(s, L.localMin(nov(9, 40))), null);
});

/* ---------- Справи ---------- */

const T = (title, pr, due, createdAt = 1) => ({ ...L.newTask(title, pr, due, createdAt) });

test('Прострочене — зверху, у фокусі максимум 3 за пріоритетом', () => {
  const list = [T('a', 3, '2026-11-03', 1), T('b', 1, '2026-11-03', 2), T('c', 2, '2026-11-02', 3), T('d', 1, '2026-11-01', 4), T('e', 2, '2026-11-03', 5), T('f', 1, '2026-11-04', 6)];
  const v = L.taskView(list, '2026-11-03');
  eq(v.overdue.map((t) => t.title), ['d', 'c']);
  eq(v.focus.map((t) => t.title), ['d', 'b', 'c']);
  eq(v.upcoming.map((t) => t.title), ['f']);
  eq(v.groups.map((g) => g.items.length), [1, 1, 1]);
});

test('Незавершена справа переходить на наступний день без дубліката', () => {
  const list = [T('Звіт', 1, '2026-11-02')];
  const v = L.taskView(list, '2026-11-03');
  eq([v.overdue.length, v.openCount, list.length], [1, 1, 1]);
});

test('«Перенести» — та сама справа на завтра', () => {
  const t = T('Звіт', 1, '2026-11-01');
  const p = L.postpone(t, '2026-11-03');
  eq([p.id, p.due, p.moved], [t.id, '2026-11-04', 1]);
  eq(L.postpone(p, '2026-11-03').due, '2026-11-05', 'майбутня справа зсувається ще на день');
});

test('Захист від дублікатів: регістр, пробіли, розділові знаки', () => {
  const list = [T('Купити хліб', 2, '2026-11-03'), { ...T('Подзвонити', 2, '2026-11-03'), doneAt: 5 }];
  ok(L.findDuplicate(list, '  купити   ХЛІБ! '));
  eq(L.findDuplicate(list, 'Подзвонити'), null, 'виконана справа не є дублікатом');
  eq(L.findDuplicate(list, 'Купити хліб', list[0].id), null, 'сама себе не дублює');
});

/* ---------- Обов’язкові ---------- */

test('Обов’язкова справа не зникає з днями, рахує дні й строк', () => {
  const m = L.newMust('Подати рапорт', '2026-11-05', nov(10, 0, 1));
  const v1 = L.mustView([m], '2026-11-03');
  eq([v1.open.length, v1.open[0].age, v1.open[0].left], [1, 2, 2]);
  const v2 = L.mustView([m], '2026-11-20');
  eq([v2.open.length, v2.open[0].left], [1, -15], 'через тиждень і після строку — досі у списку');
  eq(L.mustView([{ ...m, doneAt: 9 }], '2026-11-20').open.length, 0);
});

test('Сортування обов’язкових: спершу з найближчим строком', () => {
  const a = L.newMust('без строку', '', 1), b = L.newMust('пізно', '2026-11-30', 2), c = L.newMust('скоро', '2026-11-04', 3);
  eq(L.mustView([a, b, c], '2026-11-03').open.map((x) => x.title), ['скоро', 'пізно', 'без строку']);
});

test('Очищення: виконане старше 30 днів прибирається, відкрите — ні', () => {
  const now = nov(12, 0);
  const s = { tasks: [{ doneAt: now - 31 * 864e5 }, { doneAt: now - 864e5 }, { doneAt: 0 }], musts: [{ doneAt: now - 40 * 864e5 }, { doneAt: 0 }] };
  L.purge(s, now);
  eq([s.tasks.length, s.musts.length], [2, 1]);
});

/* ---------- Дані й резервні копії ---------- */

test('Пошкоджені дані не ламають застосунок', () => {
  eq(L.cleanState(null).state.morning.arrival, '08:30');
  const { state, dropped } = L.cleanState({ tasks: [{ title: '' }, { title: 'ok', pr: 9, due: 'вчора' }, 5], musts: 'x', morning: { arrival: '25:99', buffer: 7, steps: [{ title: 'Крок', min: 999, short: 500 }] } }, nov(12, 0));
  eq(dropped, 2);
  eq([state.tasks.length, state.tasks[0].pr, state.tasks[0].due], [1, 3, '2026-11-03']);
  eq([state.morning.arrival, state.morning.buffer, state.morning.steps[0].min, state.morning.steps[0].short], ['08:30', 15, 180, 180]);
});

test('Резервна копія: створення і перевірка', () => {
  const s = L.defaultState();
  s.tasks.push(T('Звіт', 1, '2026-11-03'));
  s.musts.push(L.newMust('Рапорт'));
  s.session = session(6, 35);
  const backup = JSON.parse(JSON.stringify(L.makeBackup(s, 123)));
  const r = L.readBackup(backup);
  ok(r.ok);
  eq([r.summary.tasks, r.summary.musts, r.summary.steps, r.exportedAt, r.state.session], [1, 1, 7, 123, null]);
  eq(L.readBackup({ app: 'other' }).ok, false);
  eq(L.readBackup({ ...backup, v: 99 }).ok, false, 'новіша версія');
});

test('Текст користувача екранується перед показом', () => {
  eq(esc('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});

export function run() {
  return cases.map((c) => {
    try { c.fn(); return { name: c.name, ok: true }; } catch (e) { return { name: c.name, ok: false, error: e.message }; }
  });
}

if (typeof window === 'undefined') {
  const results = run();
  for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : ` — ${r.error}`}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nПройдено ${results.length - failed} з ${results.length}`);
  if (failed) process.exitCode = 1;
}
