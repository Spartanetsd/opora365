// ОПОРА 365 — тести логіки (без бібліотек).
// Запуск: `node tests.js` (Node 18+) або відкрийте tests.html у браузері, зокрема на iPhone.
import * as L from './logic.js';
import * as G from './logic-gear.js';
import * as D from './logic-deck.js';
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
const session = (startH, startM, extra = {}) => ({ date: '2026-11-03', tpl: 'tpl-work', startedAt: nov(startH, startM), done: {}, skipped: {}, checks: {}, short: false, finishedAt: 0, ess: {}, ...extra });
const T = (title, pr, due, createdAt = 1, extra = {}) => L.newTask(title, pr, due, createdAt, extra);
const fresh = () => {
  const s = L.defaultState();
  s.settings.lastBackupAt = nov(8, 0);
  return s;
};
const work = (s = L.defaultState()) => L.currentTpl(s);

/* ---------- Час ---------- */

test('Розбір і формат часу', () => {
  eq(L.parseHM('08:30'), 510);
  eq(L.parseHM('7:05'), 425);
  eq(L.parseHM('24:00'), null);
  eq(L.parseHM('ab'), null);
  eq(L.fmtHM(-20), '23:40');
  eq(L.fmtHM(1445), '00:05');
  eq(L.fmtHM(509.99999999), '08:30', 'похибка дробових хвилин');
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

test('Дати: різниця днів, дні тижня, перевірка дати', () => {
  eq(L.diffDays('2026-10-24', '2026-10-26'), 2);
  eq(L.addDays('2026-12-31', 1), '2027-01-01');
  eq(L.weekday('2026-11-03'), 2);
  eq(L.longDate('2026-11-03'), 'вівторок, 3 листопада');
  eq(L.shortDate('2026-11-04', '2026-11-03'), 'завтра');
  eq(L.shortDate('2026-11-09', '2026-11-03'), 'пн, 9 лист.');
  eq([L.isKey('2026-02-28'), L.isKey('2026-02-30'), L.isKey('вчора')], [true, false, false]);
});

test('Відмінювання і відносний час', () => {
  eq([1, 2, 5, 11, 21, 22, 25, 112].map(L.daysWord), ['1 день', '2 дні', '5 днів', '11 днів', '21 день', '22 дні', '25 днів', '112 днів']);
  eq([L.relIn(25), L.relIn(0.4), L.relIn(-90)], ['через 25 хв', 'зараз', '1 год 30 хв тому']);
  eq([L.greeting(7 * 60), L.greeting(13 * 60), L.greeting(19 * 60), L.greeting(23 * 60)], ['Доброго ранку', 'Доброго дня', 'Доброго вечора', 'Доброї ночі']);
});

/* ---------- Ранок 2.0 ---------- */

test('Час виходу = прибуття − дорога − запас; підйом = вихід − кроки', () => {
  const p = L.computePlan(work());
  eq(L.fmtHM(p.departure), '07:35');
  eq(p.total, 55);
  eq(L.fmtHM(p.wake), '06:40');
  eq(p.steps.map((s) => L.fmtHM(s.start)), ['06:40', '06:45', '07:00', '07:15', '07:25', '07:30']);
});

test('Шаблони ранку: п’ять сценаріїв, власний шаблон, «Вихідний» без дороги', () => {
  const s = L.defaultState();
  eq(s.morning.templates.map((t) => t.name), ['Робочий день', 'Навчання', 'Чергування', 'Вихідний', 'Дорога']);
  const off = L.tplById(s, 'tpl-off');
  const p = L.computePlan(off);
  eq([L.fmtHM(p.departure), p.travel, L.endLabel(off)], ['10:00', 0, 'Початок дня']);
  s.morning.active = 'tpl-duty';
  eq(L.fmtHM(L.computePlan(L.currentTpl(s)).departure), '06:30', 'чергування: 07:30 − 40 − 20');
  const st = L.cleanState({ v: 3, morning: { active: 'x1', templates: [{ id: 'x1', kind: 'custom', name: 'Тир', arrival: '10:15', transport: 'car', travel: { car: 30 }, buffer: 5, steps: [{ title: 'Кава', min: 10, short: 5 }] }] } }).state;
  eq([st.morning.templates.length, st.morning.active, L.currentTpl(st).name, L.fmtHM(L.computePlan(L.currentTpl(st)).departure)], [6, 'x1', 'Тир', '09:40']);
});

test('Зміна транспорту й запасу перераховує час', () => {
  const m = { ...work(), transport: 'taxi', buffer: 10 };
  eq(L.fmtHM(L.computePlan(m).departure), '08:00');
});

test('«Часу обмаль» не скорочує критичні перевірки', () => {
  const duty = L.tplById(L.defaultState(), 'tpl-duty');
  const p = L.computePlan(duty, true);
  eq(p.total, 33);
  const crit = p.steps.find((s) => s.critical);
  eq(crit.dur, crit.min, 'критичний крок');
  ok(p.steps.every((s) => s.critical || s.dur <= s.min));
});

test('План, що переходить на попередню добу', () => {
  const m = { ...work(), arrival: '00:20', transport: 'car', travel: { bus: 40, car: 30, taxi: 20, walk: 35, none: 0 }, buffer: 10 };
  const p = L.computePlan(m);
  eq(L.fmtHM(p.departure), '23:40');
  ok(p.wakePrevDay);
});

test('План діє на сьогодні до виходу + 2 год, потім — на завтра', () => {
  const m = work();
  eq(L.planTarget(m, L.localMin(nov(7, 0))), '2026-11-03');
  eq(L.planTarget(m, L.localMin(nov(9, 30))), '2026-11-03');
  eq(L.planTarget(m, L.localMin(nov(9, 40))), '2026-11-04');
});

test('Підготовка вчасно, поточний крок, «Часу обмаль», запізнення', () => {
  const s = L.defaultState();
  const a = L.sessionStatus(s, session(6, 35), nov(6, 35));
  eq([a.level, a.remaining, a.toDep, a.spare], ['ok', 55, 60, 5]);
  const b = L.sessionStatus(s, session(6, 35), nov(6, 38));
  eq([b.current.title, b.current.left, L.fmtHM(b.current.start), L.fmtHM(b.current.end), b.remaining, b.index], ['Прокинутися', 2, '06:35', '06:40', 52, 1]);
  const c = L.sessionStatus(s, session(6, 55), nov(6, 55));
  eq([c.level, c.spare, c.altSpare], ['tight', -15, 17]);
  const d = L.sessionStatus(s, session(7, 20, { short: true }), nov(7, 20));
  eq([d.level, L.fmtHM(d.expected)], ['late', '07:43']);
});

// Ранок як у користувача: 7 кроків, 54 хв, вихід 06:30. О 06:26 п'ять кроків виконано.
function userMorning() {
  const s = L.defaultState();
  const t = L.currentTpl(s);
  const mk = (title, min, critical = false) => ({ id: L.uid(), title, min, short: critical ? min : Math.max(1, Math.round(min / 2)), critical, items: [], kind: '' });
  t.arrival = '07:25'; t.transport = 'bus'; t.travel.bus = 35; t.buffer = 20;
  t.steps = [mk('Прокинутися', 3), mk('Гігієна', 12, true), mk('Сніданок і вода', 12, true), mk('Особисті речі', 7), mk('Документи, телефон, заряд', 5, true), mk('Перевірка завдань', 10, true), mk('Одягнутися й вийти', 5)];
  const ids = t.steps.map((x) => x.id);
  const at = (h, m, sec = 0) => nov(h, m) + sec * 1000;
  const done = { [ids[0]]: at(5, 39, 10), [ids[1]]: at(5, 51, 20), [ids[2]]: at(6, 13, 5), [ids[3]]: at(6, 20, 2), [ids[4]]: at(6, 20, 40) };
  return { s, ids, ss: session(5, 36, { done }) };
}

test('Ранок: числа на екрані узгоджені між собою (06:26, запізнення)', () => {
  const { s, ss } = userMorning();
  const p = L.computePlan(L.currentTpl(s));
  eq([L.fmtHM(p.departure), L.fmtHM(p.wake), p.total], ['06:30', '05:36', 54]);
  const st = L.sessionStatus(s, ss, nov(6, 26) + 41000);
  const c = st.current;
  eq([c.title, L.fmtHM(c.start), c.left, L.fmtHM(c.end)], ['Перевірка завдань', '06:20', 4, '06:30'], 'поточний крок: з 06:20, ще 4 хв, до 06:30');
  const next = st.rows.find((r) => r.state === 'todo' && r !== c);
  eq(L.fmtHM(next.start), L.fmtHM(c.end), 'наступний крок починається, коли закінчується поточний');
  eq([L.fmtHM(st.expected), st.depAt - st.expected, st.spare], ['06:35', -5, -5], 'вихід о 06:35 — рівно на 5 хв пізніше 06:30');
  eq(st.level, 'late');
  eq(st.toDep, 4, 'до виходу за годинником: 06:26 → 06:30');
});

test('Ранок: шкала часу йде за зростанням за будь-яких позначок', () => {
  const { s, ids } = userMorning();
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let k = 0; k < 400; k++) {
    const start = nov(5, 20) + Math.floor(rnd() * 40) * 60000;
    const done = {}, skipped = {};
    let t = start;
    for (const id of ids) {
      t += Math.floor(rnd() * 15 * 60000);
      const r = rnd();
      if (r < 0.45) done[id] = t; else if (r < 0.55) skipped[id] = rnd() < 0.5 ? true : t;
    }
    const now = Math.max(t, start) + Math.floor(rnd() * 30 * 60000);
    const st = L.sessionStatus(s, session(5, 20, { startedAt: start, done, skipped, short: rnd() < 0.3 }), now);
    const todo = st.rows.filter((r) => r.state === 'todo');
    for (let i = 1; i < todo.length; i++) eq(todo[i].start, todo[i - 1].end, `крок ${i}: початок = кінець попереднього`);
    for (const r of todo) ok(r.end >= r.start && r.left >= 0 && Number.isInteger(r.start) && Number.isInteger(r.end), 'цілі хвилини без відʼємних');
    if (todo.length) eq(st.expected, todo[todo.length - 1].end, 'очікуваний вихід = кінець останнього кроку');
    else eq(st.expected, st.now);
    ok(st.expected >= st.now, 'вихід не раніше, ніж зараз');
    eq(st.spare, st.depAt - st.expected);
  }
});

test('Ранок: пропуск кроку теж рахується як позначка; сторонні позначки не впливають', () => {
  const { s, ids, ss } = userMorning();
  ss.skipped[ids[5]] = nov(6, 24);
  const st = L.sessionStatus(s, ss, nov(6, 26));
  eq([st.current.title, L.fmtHM(st.current.start), st.current.left], ['Одягнутися й вийти', '06:24', 3]);
  const ss2 = { ...ss, skipped: {}, done: { ...ss.done, 'чужий-крок': nov(6, 25) } };
  eq(L.fmtHM(L.sessionStatus(s, ss2, nov(6, 26)).current.start), '06:20', 'позначка кроку з іншого шаблону ігнорується');
});

test('Ранок: крок, що триває довше запланованого', () => {
  const { s, ss } = userMorning();
  const st = L.sessionStatus(s, ss, nov(6, 34));
  eq([st.current.left, st.current.over, L.fmtHM(st.current.end), L.fmtHM(st.expected), st.spare], [0, 4, '06:34', '06:39', -9]);
});

test('Виконані кроки зменшують залишок; «Вихід без забутого» — лише ручні позначки', () => {
  const s = L.defaultState();
  const ids = work(s).steps.map((x) => x.id);
  const done = { [ids[0]]: nov(6, 40), [ids[1]]: nov(6, 50), [ids[2]]: nov(6, 50) };
  const st = L.sessionStatus(s, session(6, 35, { done }), nov(6, 50));
  eq([st.current.title, st.remaining, st.level, st.doneCount, st.index], ['Особисті речі', 20, 'ok', 3, 4]);
  const all = Object.fromEntries(ids.map((id) => [id, nov(7, 30)]));
  const fin = L.sessionStatus(s, session(6, 35, { done: all }), nov(7, 30));
  eq([fin.finished, fin.complete, fin.needEss, fin.essDone, fin.essTotal], [true, false, true, 0, 5], 'кроки виконано, перелік — ні');
  s.session = session(6, 35, { done: all });
  eq(L.nextAction(s, nov(7, 30)).main.kind, 'ess');
  const ess = Object.fromEntries(s.morning.essentials.map((e) => [e.id, nov(7, 31)]));
  ok(L.sessionStatus(s, session(6, 35, { done: all, ess }), nov(7, 31)).complete, 'усе позначено вручну');
});

test('Сесія ранку застаріває через 2 год після виходу', () => {
  const s = L.defaultState();
  s.session = session(6, 35);
  ok(L.activeSession(s, L.localMin(nov(9, 30))));
  eq(L.activeSession(s, L.localMin(nov(9, 40))), null);
});

/* ---------- Справи ---------- */

test('Прострочене — зверху; три шари: головне, три пріоритети, решта', () => {
  const list = [T('a', 3, '2026-11-03', 1), T('b', 1, '2026-11-03', 2), T('c', 2, '2026-11-02', 3), T('d', 1, '2026-11-01', 4), T('e', 2, '2026-11-03', 5), T('f', 1, '2026-11-04', 6), T('g', 3, '2026-11-03', 7)];
  const v = L.taskView(list, '2026-11-03');
  eq(v.overdue.map((t) => t.title), ['d', 'c']);
  eq(v.focus.map((t) => t.title), ['d', 'b', 'c']);
  eq([v.main.title, v.top.map((t) => t.title), v.more.map((t) => t.title)], ['d', ['b', 'c', 'e'], ['a', 'g']]);
  eq(v.upcoming.map((t) => t.title), ['f']);
  const pinned = L.taskView(list, '2026-11-03', { id: list[4].id, date: '2026-11-03' });
  eq([pinned.main.title, pinned.top[0].title], ['e', 'd'], 'закріплена головна справа');
  eq(L.taskView(list, '2026-11-03', { id: list[4].id, date: '2026-11-02' }).main.title, 'd', 'вчорашнє закріплення не діє');
});

test('У межах пріоритету раніше — справа з ранішим дедлайном, потім із ранішим часом', () => {
  const list = [T('без часу', 2, '2026-11-03', 1), T('о 15', 2, '2026-11-03', 2, { time: '15:00' }), T('о 9', 2, '2026-11-03', 3, { time: '09:00' }), T('дедлайн', 2, '2026-11-03', 4, { deadline: '2026-11-05' })];
  eq(L.taskView(list, '2026-11-03').ordered.map((t) => t.title), ['дедлайн', 'о 9', 'о 15', 'без часу']);
});

test('Справа без дати не прострочується і не потрапляє в день', () => {
  const list = [T('колись', 2, '', 1), T('сьогодні', 2, '2026-11-03', 2)];
  const v = L.taskView(list, '2026-11-20');
  eq([v.nodate.map((t) => t.title), v.overdue.map((t) => t.title), v.openCount], [['колись'], ['сьогодні'], 1]);
  eq(L.deadlineInfo(list[0], nov(10, 0)), null);
  eq(L.makeRep('daily', ''), null, 'повторення потребує дати');
});

test('Незавершена справа переходить на наступний день без дубліката', () => {
  const list = [T('Звіт', 1, '2026-11-02')];
  const v = L.taskView(list, '2026-11-03');
  eq([v.overdue.length, v.openCount, list.length], [1, 1, 1]);
});

test('«Перенести» — та сама справа; дедлайн не змінюється автоматично', () => {
  const t = T('Звіт', 1, '2026-11-01', 1, { deadline: '2026-11-02' });
  const p = L.postpone(t, '2026-11-03');
  eq([p.id, p.due, p.moved, p.deadline], [t.id, '2026-11-04', 1, '2026-11-02']);
  eq(L.postpone(p, '2026-11-03').due, '2026-11-05', 'майбутня справа зсувається ще на день');
  eq(L.postpone(T('x', 2, ''), '2026-11-03', '2026-11-10').due, '2026-11-10', 'справа без дати — на обрану дату');
  const late = L.deadlineInfo(p, nov(12, 0));
  eq([late.level, late.text], ['late', 'дедлайн минув учора']);
});

test('Захист від дублікатів: регістр, пробіли, розділові знаки', () => {
  const list = [T('Купити хліб', 2, '2026-11-03'), { ...T('Подзвонити', 2, '2026-11-03'), doneAt: 5 }, { ...T('Скасована', 2, '2026-11-03'), cancelledAt: 5 }];
  ok(L.findDuplicate(list, '  купити   ХЛІБ! '));
  eq(L.findDuplicate(list, 'Подзвонити'), null, 'виконана справа не є дублікатом');
  eq(L.findDuplicate(list, 'Скасована'), null, 'скасована справа не є дублікатом');
  eq(L.findDuplicate(list, 'Купити хліб', list[0].id), null, 'сама себе не дублює');
});

test('Повторювані справи: наступна дата за правилом', () => {
  eq(L.nextDue({ k: 'daily' }, '2026-11-04'), '2026-11-05');
  eq(L.nextDue({ k: 'weekdays' }, '2026-11-06'), '2026-11-09', 'пʼятниця → понеділок');
  eq(L.nextDue({ k: 'weekly', days: [1, 3] }, '2026-11-04'), '2026-11-09', 'ср → пн');
  eq(L.nextDue({ k: 'weekly', days: [1, 3] }, '2026-11-02'), '2026-11-04', 'пн → ср');
  eq(L.nextDue({ k: 'monthly', dom: 31 }, '2026-11-04'), '2026-11-30');
  eq(L.nextDue({ k: 'monthly', dom: 31 }, '2026-01-31'), '2026-02-28');
  eq(L.nextDue({ k: 'monthly', dom: 4 }, '2026-12-04'), '2027-01-04');
  eq(L.repLabel({ k: 'weekly', days: [0, 1, 3] }), 'щотижня: пн, ср, нд');
});

test('Виконання повторюваної справи створює наступну без дублікатів; «Скасувати» прибирає її', () => {
  const s = fresh();
  const t = T('Звіт за тиждень', 2, '2026-11-02', nov(9, 0, 1), { rep: { k: 'daily' }, sub: [{ id: 'a', t: 'Зібрати дані', d: 5 }] });
  s.tasks.push(t);
  const r = L.completeTask(s, t.id, nov(10, 0));
  eq([r.spawned.due, r.spawned.sid, r.spawned.sub[0].d, s.tasks.length], ['2026-11-04', t.sid, 0, 2], 'прострочена → від сьогодні');
  eq(L.completeTask(s, t.id, nov(10, 0)), null, 'повторне виконання ігнорується');
  L.undoTask(s, t.id);
  eq([s.tasks.length, t.doneAt], [1, 0]);
  const twin = { ...T('Звіт за тиждень', 2, '2026-11-05'), sid: t.sid, rep: { k: 'daily' } };
  s.tasks.push(twin);
  eq(L.completeTask(s, t.id, nov(10, 0)).spawned, null, 'відкритий екземпляр серії вже є');
});

test('Скасування, архів, повернення з архіву, пошук і фільтр', () => {
  const s = fresh();
  const a = T('Оплатити інтернет', 2, '2026-11-03', 1, { cat: 'money', note: 'Київстар' });
  const b = T('Купити ліки', 1, '2026-11-03', 2, { cat: 'health' });
  s.tasks.push(a, b);
  ok(L.cancelTask(s, a.id, nov(10, 0)));
  L.completeTask(s, b.id, nov(11, 0));
  eq(L.taskView(s.tasks, '2026-11-03').openCount, 0);
  eq(L.archiveView(s).map((e) => [e.x.title, e.how]), [['Купити ліки', 'done'], ['Оплатити інтернет', 'cancel']]);
  eq(L.archiveView(s, 'київстар').length, 1, 'пошук у нотатці');
  eq(L.archiveView(s, '', 'health').map((e) => e.x.title), ['Купити ліки']);
  L.restoreTask(s, a.id);
  eq([a.cancelledAt, L.taskView(s.tasks, '2026-11-03').openCount], [0, 1]);
  ok(L.matches(T('Звіт', 2, '', 1, { sub: [{ id: 'q', t: 'таблиця', d: 0 }] }), 'табл'), 'пошук у кроках');
});

test('Шкала строку рахується з реального часу', () => {
  const late = L.deadlineInfo(T('x', 1, '2026-11-01'), nov(12, 0));
  eq([late.level, late.frac, late.text], ['late', 1, 'прострочено 2 дні']);
  const timed = L.deadlineInfo(T('x', 2, '2026-11-03', nov(10, 0), { time: '14:00' }), nov(13, 10));
  eq([timed.level, Math.round(timed.frac * 100), timed.text], ['soon', 79, 'о 14:00, через 50 хв']);
  const m = L.newMust('рапорт', '2026-11-05', nov(10, 0, 1));
  eq(L.deadlineInfo(m, nov(10, 0), 'must').text, 'до чт, 5 лист. (ще 2 дні)');
  eq(L.deadlineInfo(T('x', 3, '2026-11-09', 1, { deadline: '2026-11-04' }), nov(10, 0)).text, 'дедлайн завтра');
});

/* ---------- «Не забути» ---------- */

test('«Не забути» не зникає з днями, рахує дні й строк', () => {
  const m = L.newMust('Подати рапорт', '2026-11-05', nov(10, 0, 1));
  const v1 = L.mustView([m], '2026-11-03');
  eq([v1.open.length, v1.open[0].age, v1.open[0].left], [1, 2, 2]);
  const v2 = L.mustView([m], '2026-11-20');
  eq([v2.open.length, v2.open[0].left], [1, -15], 'через тиждень і після строку — досі у списку');
  eq(L.mustView([{ ...m, doneAt: 9 }], '2026-11-20').open.length, 0);
});

test('Сортування «Не забути»: спершу з найближчим строком', () => {
  const a = L.newMust('без строку', '', 1), b = L.newMust('пізно', '2026-11-30', 2), c = L.newMust('скоро', '2026-11-04', 3);
  eq(L.mustView([a, b, c], '2026-11-03').open.map((x) => x.title), ['скоро', 'пізно', 'без строку']);
});

test('«Не забути»: «Перенести» лишає у списку, але знімає з наступної дії до дати', () => {
  const s = fresh();
  const m = L.newMust('Рапорт', '2026-11-02', nov(9, 0, 1));
  s.musts.push(m);
  eq(L.nextAction(s, nov(10, 0)).main.title, 'Рапорт');
  Object.assign(m, L.moveMust(m, '2026-11-05'));
  const v = L.mustView(s.musts, '2026-11-03');
  eq([v.open.length, v.active.length, v.parked.length, m.deadline, m.moved], [1, 0, 1, '2026-11-02', 1], 'строк не змінено');
  ok(!L.nextAction(s, nov(10, 0)).list.some((c) => c.kind === 'must'));
  eq(L.nextAction(s, nov(10, 0, 5)).main.title, 'Рапорт', 'з обраної дати — знову на виду');
  m.cancelledAt = nov(11, 0, 5);
  eq([L.mustView(s.musts, '2026-11-05').open.length, L.archiveView(s)[0].how], [0, 'cancel']);
});

/* ---------- Режими і наступна дія ---------- */

test('Автоматичний режим: ранок, день, вечір, відпочинок; ручний — до кінця доби', () => {
  const s = fresh();
  eq([L.autoMode(s, nov(5, 50)), L.autoMode(s, nov(7, 40)), L.autoMode(s, nov(21, 30)), L.autoMode(s, nov(2, 0))], ['morning', 'day', 'evening', 'rest']);
  eq([L.autoMode(s, nov(4, 59)), L.autoMode(s, nov(17, 59)), L.autoMode(s, nov(18, 0)), L.autoMode(s, nov(22, 0))], ['rest', 'day', 'evening', 'rest']);
  L.setMode(s, 'ready', true, nov(12, 0));
  eq(L.modeInfo(s, nov(23, 50)).id, 'ready');
  eq(L.modeInfo(s, nov(8, 0, 4)).id, 'day', 'наступного дня — знову авто');
  L.setMode(s, 'rest', false, nov(12, 0));
  eq(L.modeInfo(s, nov(8, 0, 9)).id, 'rest', 'до скасування');
  L.setMode(s, 'auto');
  eq(L.modeInfo(s, nov(12, 0)).manual, false);
});

test('Автоматичний режим: пізній підйом — ранок до виходу; вечір; відпочинок після півночі; привітання', () => {
  const s = fresh();
  const t = L.currentTpl(s);
  t.arrival = '12:00'; t.transport = 'car'; t.travel.car = 190; t.buffer = 10; // підйом 07:45, вихід 08:40
  const p = L.autoPlan(s, nov(6, 34));
  eq([p.id, L.fmtHM(p.until), p.by], ['morning', '08:40', 'dep'], 'о 06:34 — ранок, а не день');
  eq([L.autoMode(s, nov(4, 30)), L.autoMode(s, nov(5, 0)), L.autoMode(s, nov(8, 39)), L.autoMode(s, nov(8, 41))], ['rest', 'morning', 'morning', 'day']);
  eq([L.greetingFor('morning', 6 * 60 + 34), L.greetingFor('day', 17 * 60 + 30), L.greetingFor('ready', 19 * 60)], ['Доброго ранку', 'Доброго дня', 'Доброго вечора']);
  s.session = { ...session(7, 45), finishedAt: nov(8, 20) };
  eq(L.autoMode(s, nov(8, 25)), 'day', 'підготовку завершено — далі день');
  s.session = session(7, 45);
  eq(L.autoMode(s, nov(9, 30)), 'morning', 'підготовка триває навіть після часу виходу');
  const n = fresh();
  n.settings.eveningAt = '19:00'; n.settings.restAt = '00:30';
  eq([L.autoMode(n, nov(18, 30)), L.autoMode(n, nov(23, 50)), L.autoMode(n, nov(0, 10)), L.autoMode(n, nov(0, 40))], ['day', 'evening', 'evening', 'rest'], 'відпочинок після півночі');
  eq(L.autoPlan(n, nov(0, 10)).until, nov(0, 30) / 60000 + 120, 'вечір до 00:30');
  const old = L.cleanState({ settings: { restAt: '21:00' } }, nov(10, 0)).state.settings;
  eq([old.eveningAt, old.restAt], ['18:00', '22:00'], 'старе типове «Вечір з 21:00» → нові типові');
  ok(!L.nextAction(fresh(), nov(19, 0)).list.some((c) => c.kind === 'morning'), 'увечері ранок не нав’язується');
});

test('Наступна дія: ранкова підготовка має перевагу, крок — найвищу', () => {
  const s = fresh();
  s.tasks.push(T('Звіт', 1, '2026-11-03', nov(6, 0)));
  const a = L.nextAction(s, nov(6, 40));
  eq([a.mode.id, a.main.kind, a.then.kind], ['morning', 'morning', 'task']);
  eq(a.main.reason, 'Робочий день: вихід о 07:35, через 55 хв');
  s.session = session(6, 40);
  eq(L.nextAction(s, nov(6, 41)).main.title, 'Прокинутися');
  L.setMode(s, 'rest', true, nov(6, 41));
  s.session = null;
  eq(L.nextAction(s, nov(6, 42)).main.kind, 'task', 'у режимі «Відпочинок» ранок не нав’язується');
});

test('Наступна дія: прострочене «Не забути», справа з часом, пріоритет; відкладене пропускається', () => {
  const s = fresh();
  const t1 = T('Купити хліб', 3, '2026-11-03', 1);
  const t2 = T('Нарада', 2, '2026-11-03', 2, { time: '12:30' });
  const t3 = T('Звіт', 1, '2026-11-03', 3);
  s.tasks.push(t1, t2, t3);
  eq(L.nextAction(s, nov(10, 0)).main.title, 'Звіт');
  const m = L.newMust('Рапорт', '2026-11-02', nov(9, 0, 1));
  s.musts.push(m);
  eq(L.nextAction(s, nov(10, 0)).main.title, 'Рапорт', 'прострочене «Не забути» вище за пріоритет');
  eq(L.nextAction(s, nov(12, 0)).main.title, 'Нарада', 'за пів години до наради');
  L.defer(s, `task:${t2.id}`, 60, nov(12, 0));
  eq(L.nextAction(s, nov(12, 10)).main.title, 'Рапорт');
  const back = L.nextAction(s, nov(13, 5)).main;
  eq([back.title, back.reason], ['Нарада', 'Важливо, мало бути о 12:30'], 'відкладення минуло');
  m.doneAt = nov(16, 0);
  eq(L.nextAction(s, nov(16, 0)).main.title, 'Звіт', 'нарада, що минула кілька годин тому, не випереджає «Обовʼязково»');
});

test('Пропущена подія лишається першою тим коротше, чим нижчий пріоритет', () => {
  const s = fresh();
  s.tasks.push(T('Звіт', 1, '2026-11-03', 1, { deadline: '2026-11-03' }), T('Подзвонити', 3, '2026-11-03', 2, { time: '19:30' }));
  eq(L.nextAction(s, nov(19, 50)).main.title, 'Подзвонити', '20 хв після — ще першою');
  eq(L.nextAction(s, nov(20, 10)).main.title, 'Звіт', '«Можна пізніше» через 40 хв — уже ні');
  s.tasks[1].pr = 1;
  eq(L.nextAction(s, nov(21, 0)).main.title, 'Подзвонити', '«Обовʼязково» — до 2 год після часу');
});

test('Наступна дія: дедлайн піднімає справу; «Обрати іншу» — ваш вибір першим до кінця дня', () => {
  const s = fresh();
  const a = T('Звіт', 1, '2026-11-03', 1);
  const b = T('Довідка', 3, '2026-11-03', 2, { deadline: '2026-11-03' });
  s.tasks.push(a, b);
  const r = L.nextAction(s, nov(10, 0)).main;
  eq([r.title, r.reason], ['Довідка', 'Можна пізніше, дедлайн сьогодні']);
  s.pick = { key: `task:${a.id}`, date: '2026-11-03' };
  const p = L.nextAction(s, nov(10, 5)).main;
  eq([p.title, p.picked, p.reason], ['Звіт', true, 'Обрано вами. Обовʼязково сьогодні']);
  L.purge(s, nov(8, 0, 4));
  eq(s.pick.key, '', 'наступного дня вибір скидається');
});

test('Наступна дія у «Готовності»: спершу перевірки; ввечері — підсумок дня', () => {
  const s = fresh();
  s.tasks.push(T('Звіт', 2, '2026-11-03', 1));
  L.setMode(s, 'ready', true, nov(12, 0));
  const r = L.nextAction(s, nov(12, 0));
  eq([r.main.kind, r.main.title], ['gear', 'Перевірити: Службове підзвітне майно']);
  const e = fresh();
  for (const c of G.GEAR_CATS) { G.startCheck(e.gear, c.id, 'weekly', nov(8, 0)); for (const i of e.gear.cats[c.id].items) G.markItem(e.gear, c.id, i.id, 'ok'); G.finishCheck(e.gear, c.id, nov(8, 10)); }
  eq(L.nextAction(e, nov(21, 30)).main.kind, 'evening');
  L.closeDay(e, nov(21, 40));
  eq(L.nextAction(e, nov(21, 45)).main, null, 'після підсумку — тиша');
});

test('Пульс дня: лише реальні дані', () => {
  const s = fresh();
  s.tasks.push(T('a', 1, '2026-11-03', 1), T('b', 2, '2026-11-02', 2), { ...T('c', 2, '2026-11-03', 3), doneAt: nov(9, 0) }, T('Нарада', 3, '2026-11-03', 4, { time: '14:00' }));
  const p = L.pulseData(s, nov(10, 0));
  eq([p.done, p.open, p.total, p.pct, p.prioOpen, p.overdue, p.checks], [1, 3, 4, 25, 2, 1, 5]);
  eq([p.next.title, L.fmtHM(p.next.t), p.beats.map((b) => b.m)], ['Нарада', '14:00', [540]]);
  eq(L.pulseData(L.defaultState(), nov(10, 0)).pct, null, 'без справ — без відсотка');
});

test('Події дня: за часом', () => {
  const s = fresh();
  s.tasks.push(T('Нарада', 2, '2026-11-03', 1, { time: '14:00' }), T('Завтра', 2, '2026-11-04', 1, { time: '09:00' }));
  const ev = L.dayEvents(s, nov(10, 0));
  eq(ev.events.map((e) => `${L.fmtHM(e.t)} ${e.title}`), ['06:40 Підйом', '07:35 Вихід', '08:30 Прибуття', '14:00 Нарада']);
});

test('Підсумок дня одним рядком', () => {
  const s = fresh();
  s.tasks.push(T('a', 1, '2026-11-02', 1), T('b', 2, '2026-11-03', 1));
  s.musts.push(L.newMust('m'));
  eq(L.daySummary(s, nov(10, 0)), '2 справи, з них прострочено 1, не забути 1, 5 перевірок потрібно');
});

/* ---------- Вечірній підсумок, тиждень, фокус ---------- */

test('Вечірній підсумок: день до 04:00 — попередній, закриття дня', () => {
  const s = fresh();
  const a = T('Звіт', 1, '2026-11-03', 1);
  s.tasks.push(a, { ...T('Готово', 2, '2026-11-03', 2), doneAt: nov(15, 0) }, T('Завтрашня', 2, '2026-11-04', 3));
  eq(L.closeoutDay(nov(1, 30, 4)), '2026-11-03');
  const ed = L.eveningData(s, nov(1, 30, 4));
  eq([ed.day, ed.tomorrow, ed.doneTasks.length, ed.remaining.map((t) => t.title), ed.tomorrowTasks.map((t) => t.title)], ['2026-11-03', '2026-11-04', 1, ['Звіт'], ['Завтрашня']]);
  Object.assign(a, L.postpone(a, ed.day, ed.tomorrow));
  eq(L.closeDay(s, nov(1, 31, 4), 1), '2026-11-03');
  eq(s.days['2026-11-03'].moved, 1);
});

test('Підсумки тижня: реальні виконання за 7 днів', () => {
  const s = fresh();
  s.tasks.push({ ...T('a', 2, '2026-11-02', 1), doneAt: nov(10, 0, 2) }, { ...T('b', 2, '2026-11-03', 1), doneAt: nov(9, 0) }, { ...T('c', 2, '2026-11-03', 1), cancelledAt: nov(9, 0) }, { ...T('старе', 2, '2026-10-01', 1), doneAt: nov(9, 0, 1) - 40 * 864e5 });
  const w = L.weekStats(s, nov(12, 0));
  eq([w.rows.length, w.rows[6].date, w.tasks, w.rows[5].tasks, w.rows[6].tasks, w.max], [7, '2026-11-03', 2, 1, 1, 1]);
});

test('Таймер «Фокусу» рахує залишок', () => {
  const s = fresh();
  s.focus = { id: 'x', start: nov(10, 0), mins: 25 };
  eq([L.focusLeft(s, nov(10, 5)).left, L.focusLeft(s, nov(10, 30)).over], [1200, true]);
});

/* ---------- Центр готовності ---------- */

test('Готовність: без перевірки — «Потрібна перевірка», після повної — «Без зауважень»', () => {
  const g = G.defaultGear();
  eq(G.catStatus(g, 'med', nov(10, 0)).s, 'needs');
  G.startCheck(g, 'med', 'duty', nov(10, 0));
  const ids = g.cats.med.items.map((i) => i.id);
  G.markItem(g, 'med', ids[0], 'ok');
  const run = G.catStatus(g, 'med', nov(10, 1));
  eq([run.s, run.marked, run.total], ['running', 1, 9]);
  eq(G.finishCheck(g, 'med', nov(10, 2)).ok, false, 'не всі предмети позначено');
  for (const id of ids) G.markItem(g, 'med', id, 'ok');
  const r = G.finishCheck(g, 'med', nov(10, 5));
  eq([r.ok, r.sum.clean, G.catStatus(g, 'med', nov(10, 6)).s, g.history[0].type], [true, true, 'ok', 'duty']);
});

test('Готовність: відсутнє, усунення, давність, нові та прострочені предмети', () => {
  const g = G.defaultGear();
  const items = g.cats.alarm.items;
  G.startCheck(g, 'alarm', 'weekly', nov(10, 0));
  items.forEach((i, n) => G.markItem(g, 'alarm', i.id, n === 1 ? 'missing' : 'ok', 'нема води'));
  G.finishCheck(g, 'alarm', nov(10, 5));
  const st = G.catStatus(g, 'alarm', nov(10, 6));
  eq([st.s, st.text], ['issues', 'Відсутнє: 1']);
  eq(G.checkIssues(g.history[0]).map((x) => [x.name, x.note]), [['Вода', 'нема води']]);
  ok(G.fixIssue(g, 'alarm', items[1].id, nov(11, 0)));
  eq([G.catStatus(g, 'alarm', nov(11, 1)).s, g.history[0].marks[items[1].id]], ['ok', 'missing'], 'запис перевірки не переписано');
  eq(G.catStatus(g, 'alarm', nov(11, 0, 3 + 31)).s, 'needs', 'після періоду 30 днів');
  items.push(G.cleanItem({ name: 'Нова ковдра' }, nov(12, 0)));
  eq(G.catStatus(g, 'alarm', nov(12, 1)).reason, 'new', 'новий предмет не перевірено');
  items.pop();
  items[0].exp = '2026-11-01';
  eq([G.catStatus(g, 'alarm', nov(12, 1)).s, G.itemStatus(g, 'alarm', items[0], nov(12, 1)).s], ['issues', 'refill'], 'термін придатності минув');
});

test('Статуси предмета: перевірено, не перевірено, відсутнє, несправне, поповнення; кожна перевірка — окремий запис', () => {
  const g = G.defaultGear();
  const it = g.cats.comms.items;
  G.startCheck(g, 'comms', 'daily', nov(8, 0));
  ['ok', 'missing', 'broken', 'refill', 'ok', 'ok'].forEach((m, i) => G.markItem(g, 'comms', it[i].id, m));
  G.finishCheck(g, 'comms', nov(8, 5));
  eq(it.slice(0, 4).map((i) => G.itemStatus(g, 'comms', i, nov(9, 0)).s), ['ok', 'missing', 'broken', 'refill']);
  eq(G.itemStatus(g, 'comms', it[0], nov(9, 0, 5)).s, 'unchecked', 'період 1 день минув');
  G.startCheck(g, 'comms', 'daily', nov(8, 0, 4));
  for (const i of it) G.markItem(g, 'comms', i.id, 'ok');
  G.finishCheck(g, 'comms', nov(8, 5, 4));
  eq([g.history.length, G.itemStatus(g, 'comms', it[1], nov(9, 0, 4)).s], [2, 'ok']);
  eq(G.problemList(g, nov(9, 0, 4)).length, 0);
});

test('Типи перевірок попередньої версії й старі позначки зберігаються без втрат', () => {
  const g = G.cleanGear({ cats: { med: { period: 7, items: [{ id: 'i1', name: 'Бинт' }, { id: 'i2', name: 'Ножиці' }] } }, history: [{ id: 'h1', cat: 'med', type: 'before', startedAt: 1, finishedAt: 2, marks: { i1: 'issue', i2: 'miss' }, names: { i1: 'Бинт', i2: 'Ножиці' } }] });
  eq([g.history[0].type, G.checkTypeName(g.history[0].type), g.history[0].marks], ['before', 'Перед виїздом', { i1: 'broken', i2: 'missing' }]);
  eq(g.cats.issued.items[0].owner, 'issued', 'підзвітне майно');
});

test('Власні категорії й набори перевірок', () => {
  const g = G.defaultGear();
  const id = G.addCategory(g, 'Автомобіль', 'car');
  eq([G.catMeta(g, id).name, G.catStatus(g, id).s, G.gearSummary(g).total, G.gearSummary(g).all], ['Автомобіль', 'empty', 5, 6]);
  g.cats[id].items.push(G.cleanItem({ name: 'Аптечка' }));
  eq(G.queueFor(g, 'duty'), ['issued', 'personal', 'med', 'comms']);
  eq(G.queueFor(g, 'daily'), ['issued', 'comms']);
  eq(G.queueFor(g, 'weekly').length, 6);
  ok(!G.removeCategory(g, 'med'), 'вбудовану не видалити');
  ok(G.removeCategory(g, id));
  eq(G.cleanGear({ custom: [{ id: 'c-x', name: 'Дача', icon: 'home' }], cats: { 'c-x': { items: [{ name: 'Ключі' }] } } }).cats['c-x'].items[0].name, 'Ключі');
});

test('Підсумок готовності і пошкоджені дані', () => {
  const g = G.cleanGear({ cats: { med: { period: 99, items: [{ name: '' }, { name: 'Бинт', qty: -5, exp: '2026-13-40' }, 7] } }, history: [{ cat: 'nope' }, { cat: 'med', startedAt: 1, finishedAt: 2, marks: { a: 'ok', b: 'boom' } }] });
  eq([g.cats.med.period, g.cats.med.items.length, g.cats.med.items[0].qty, g.cats.med.items[0].exp], [7, 1, 1, '']);
  eq([g.history.length, Object.keys(g.history[0].marks)], [1, ['a']]);
  eq(G.gearSummary(g, nov(10, 0)).total, 5);
});

/* ---------- Швидка дія ---------- */

test('Сценарій: «Готово» лише після всіх обовʼязкових кроків', () => {
  const deck = D.defaultDeck();
  const sc = deck.scenarios.find((s) => s.kind === 'go');
  eq(sc.steps.map((s) => s.t), ['Документи', 'Звʼязок', 'Живлення', 'Особисті речі', 'Екіпірування', 'Медичні засоби']);
  D.startRun(deck, sc, nov(10, 0));
  for (const s of sc.steps.slice(0, 2)) deck.active.checked[s.id] = nov(10, 1);
  const p = D.finishRun(deck, sc, nov(10, 5));
  eq([p.result, p.reqDone, p.reqTotal, p.missing], ['partial', 2, 3, ['Живлення']]);
  D.startRun(deck, sc, nov(11, 0));
  for (const s of sc.steps.filter((x) => x.req)) deck.active.checked[s.id] = nov(11, 1);
  eq(D.finishRun(deck, sc, nov(11, 2)).result, 'done');
  eq([deck.active, deck.runs.length], [null, 2]);
});

test('Сценарії: вбудовані не зникають, власні обмежені; незмінені шаблони оновлюються', () => {
  const d = D.cleanDeck({ scenarios: [{ id: 'x1', kind: 'custom', title: 'Мій', steps: [{ t: 'крок', req: true }, { t: '' }] }, { id: 'bad', kind: 'weird', title: 'x' }] });
  eq(d.scenarios.map((s) => s.kind), ['med', 'tac', 'fire', 'go', 'task', 'custom']);
  eq(d.scenarios[5].steps.length, 1);
  const oldMed = ['Уточнити час, місце і кількість слухачів', 'План-конспект і тема заняття', 'Манекени й тренажери', 'Навчальні турнікети', 'Навчальний перевʼязувальний матеріал', 'Рукавички для слухачів', 'Журнал обліку занять', 'Проєктор або планшет заряджені'];
  const up = D.cleanDeck({ scenarios: [{ id: 'sc-med', kind: 'med', title: 'Домедична допомога', steps: oldMed.map((t) => ({ t })) }, { id: 'sc-fire', kind: 'fire', title: 'Мій тир', steps: [{ t: 'Свій крок' }] }] });
  eq([up.scenarios[0].title, up.scenarios[0].steps[0].t, up.scenarios[2].title, up.scenarios[2].steps.map((s) => s.t)], ['Домедична підготовка', 'План заняття', 'Мій тир', ['Свій крок']]);
});

test('Памʼять дій: останні без повторів, обране', () => {
  const deck = D.defaultDeck();
  const [med, , , go] = deck.scenarios;
  for (const sc of [med, go, med]) { D.startRun(deck, sc, nov(10, 0)); D.finishRun(deck, sc, nov(10, 1)); }
  eq(D.recentScenarios(deck).map((x) => x.sc.id), ['sc-med', 'sc-go']);
  eq([D.toggleFav(deck, 'sc-go'), deck.favs, D.toggleFav(deck, 'sc-go'), deck.favs], [true, ['sc-go'], false, []]);
  eq(D.cleanDeck({ ...deck, favs: ['sc-go', 'nope', 'sc-go'] }).favs, ['sc-go']);
});

test('Несподіване доручення: форма → справа з дедлайном і кроками', () => {
  const t = D.assignmentTask({ what: ' Підготувати довідку ', date: '2026-11-04', time: '9:00', pr: 2, needs: 'Дані з журналу\n\nПідпис керівника' }, '2026-11-03');
  eq([t.title, t.due, t.time, t.deadline, t.pr, t.cat, t.sub.map((s) => s.t)], ['Підготувати довідку', '2026-11-04', '09:00', '2026-11-04', 2, 'work', ['Дані з журналу', 'Підпис керівника']]);
  eq(D.assignmentTask({ what: 'x', pr: 9 }, '2026-11-03').pr, 1);
  const deck = D.defaultDeck();
  D.logAssignment(deck, 'Підготувати довідку', nov(10, 0));
  eq(D.recentScenarios(deck)[0].sc.kind, 'task');
});

test('Посилання інструментів: дозволені й заборонені', () => {
  eq(D.checkUrl('alerts.in.ua').url, 'https://alerts.in.ua/');
  eq(D.checkUrl('https://www.example.com/a b').ok, false, 'пробіл');
  eq(D.checkUrl('javascript:alert(1)').ok, false);
  eq(D.checkUrl('data:text/html,hi').ok, false);
  eq(D.checkUrl('https://user:pass@example.com').ok, false, 'логін у посиланні');
  eq(D.checkUrl('https://intranet').ok, false, 'без домену');
  eq(D.checkUrl('ftp://example.com').ok, false);
  eq([D.checkUrl('tel:+380501234567').ok, D.checkUrl('mailto:a@b.ua').ok, D.checkUrl('tel:abc').ok], [true, true, false]);
  eq(D.toolHost('https://www.github.com/x'), 'github.com');
  eq([D.glyphOf({ title: 'Карта тривог', glyph: '' }), D.glyphOf({ title: 'Дія', glyph: '' }), D.glyphOf({ title: 'x', glyph: 'Ab' })], ['КТ', 'Д', 'Ab']);
});

test('Каталог інструментів: пошук, категорії, улюблені', () => {
  const tools = D.defaultTools();
  const all = D.toolView(tools);
  eq([all.fav.map((t) => t.title), all.groups.find((g) => g.id === 'work').items.map((t) => t.title)], [['Дія', 'Календар', 'Карта тривог'], ['Диск', 'Пошта']], 'улюблені не дублюються');
  const v = D.toolView(tools, 'кал');
  eq([v.count, v.fav.length, v.groups[0].items[0].title], [1, 0, 'Календар']);
  eq(D.toolView(tools, '', 'work').groups[0].items.length, 3);
  eq(D.cleanTools([{ title: 'X', url: 'javascript:1', cat: 'xxx' }])[0].cat, 'other');
});

/* ---------- Дані, міграція, резервні копії ---------- */

test('Міграція даних v1 → v3 без втрат', () => {
  const v1 = {
    v: 1, updatedAt: 5, settings: { theme: 'dark', lastBackupAt: 7, installHint: false },
    morning: { arrival: '09:00', transport: 'car', travel: { bus: 40, car: 30, taxi: 20, walk: 35 }, buffer: 10, steps: [{ id: 's1', title: 'Кава', min: 10, short: 3, critical: false, items: [], kind: '' }] },
    session: null,
    tasks: [{ id: 't1', title: 'Звіт', pr: 1, due: '2026-11-03', note: 'до обіду', createdAt: 100, doneAt: 0, moved: 2 }],
    musts: [{ id: 'm1', title: 'Рапорт', note: '', deadline: '2026-11-10', createdAt: 50, doneAt: 0 }],
  };
  const { state, from } = L.cleanState(v1, nov(10, 0));
  eq(from, 1);
  eq([state.v, state.settings.theme, state.settings.installHint, state.settings.mode.id, state.settings.onboarded], [3, 'dark', false, 'auto', true]);
  const w = L.currentTpl(state);
  eq([w.name, w.arrival, w.transport, w.travel.car, w.buffer, w.steps[0].id, w.steps[0].title], ['Робочий день', '09:00', 'car', 30, 10, 's1', 'Кава']);
  const t = state.tasks[0];
  eq([t.id, t.title, t.pr, t.note, t.moved, t.time, t.cat, t.rep, t.sid, t.sub, t.deadline, t.cancelledAt], ['t1', 'Звіт', 1, 'до обіду', 2, '', '', null, 't1', [], '', 0]);
  eq([state.musts[0].deadline, state.musts[0].returnOn, state.gear.history.length, state.deck.scenarios.length, state.tools.length], ['2026-11-10', '', 0, 5, 6]);
});

test('Міграція v2 → v3: категорії справ, типовий ранок, сесія, перевірки', () => {
  const v2steps = [['Прокинутися', 5, 2], ['Гігієна', 15, 7], ['Сніданок і вода', 15, 3], ['Особисті речі', 10, 5], ['Документи, телефон, заряд', 5, 5], ['Перевірка завдань', 5, 1], ['Одягнутися й вийти', 5, 5]].map(([title, min, short], i) => ({ id: `s${i}`, title, min, short }));
  const v2 = {
    v: 2,
    settings: { theme: 'light', name: 'Ігоре', restAt: '22:00' },
    morning: { arrival: '08:00', transport: 'walk', travel: { bus: 40, car: 25, taxi: 20, walk: 20 }, buffer: 20, steps: v2steps },
    tasks: [{ id: 'a', title: 'Довідка', pr: 2, due: '2026-11-03', cat: 'docs' }, { id: 'b', title: 'Заняття', pr: 2, due: '2026-11-03', cat: 'train' }, { id: 'c', title: 'Хліб', pr: 3, due: '2026-11-03', cat: 'buy' }, { id: 'd', title: 'Ліки', pr: 1, due: '2026-11-03', cat: 'health' }],
    gear: { cats: { med: { period: 3, items: [{ id: 'i1', name: 'Турнікет' }] } }, history: [{ id: 'h', cat: 'med', type: 'plan', startedAt: 1, finishedAt: 2, marks: { i1: 'issue' } }] },
  };
  const { state } = L.cleanState(v2, nov(10, 0));
  eq(state.tasks.map((t) => t.cat), ['work', 'study', 'home', 'health']);
  const w = L.currentTpl(state);
  eq([w.arrival, w.transport, w.travel.walk, w.buffer, w.steps.length, w.steps.some((s) => s.title === 'Документи, телефон, заряд')], ['08:00', 'walk', 20, 20, 6, false], 'незмінений типовий ранок оновлено, маршрут збережено');
  eq([state.settings.theme, state.settings.name, state.settings.eveningAt, state.settings.restAt, state.settings.onboarded], ['light', 'Ігоре', '22:00', '23:00', true], '«Вечір з 22:00» лишається вечором, відпочинок — за годину');
  eq([state.gear.cats.med.period, state.gear.history[0].marks.i1, state.gear.history[0].type], [3, 'broken', 'plan']);
  const busy = L.cleanState({ ...v2, session: { date: '2026-11-03', startedAt: 5, done: { s0: 6 } } }, nov(10, 0)).state;
  eq([L.currentTpl(busy).steps.length, busy.session.tpl, busy.session.done], [7, 'tpl-work', { s0: 6 }], 'під час ранку кроки не чіпаємо');
});

test('Пошкоджені дані не ламають застосунок', () => {
  eq(L.currentTpl(L.cleanState(null).state).arrival, '08:30');
  const { state, dropped } = L.cleanState({ tasks: [{ title: '' }, { title: 'ok', pr: 9, due: 'вчора', time: '25:00', cat: 'x', rep: { k: 'never' } }, 5], musts: 'x', gear: 7, deck: [], tools: 'x', later: { a: 'b', b: 5 }, morning: { arrival: '25:99', buffer: 7, steps: [{ title: 'Крок', min: 999, short: 500 }] }, days: { x: 1, '2026-11-01': { at: 5, done: 2 } }, focus: { id: 'q' } }, nov(12, 0));
  eq(dropped, 2);
  eq([state.tasks.length, state.tasks[0].pr, state.tasks[0].due, state.tasks[0].time, state.tasks[0].cat, state.tasks[0].rep], [1, 3, '2026-11-03', '', '', null]);
  const w = L.currentTpl(state);
  eq([w.arrival, w.buffer, w.steps[0].min, w.steps[0].short], ['08:30', 15, 180, 180]);
  eq([Object.keys(state.later), state.gear.history.length, state.deck.scenarios.length, state.tools.length, Object.keys(state.days), state.focus], [['b'], 0, 5, 6, ['2026-11-01'], null]);
});

test('Очищення: архів 180 днів, минулі відкладення, закріплення', () => {
  const now = nov(12, 0);
  const s = { tasks: [{ doneAt: now - 181 * 864e5 }, { doneAt: now - 31 * 864e5 }, { cancelledAt: now - 200 * 864e5 }, { doneAt: 0 }], musts: [{ doneAt: now - 190 * 864e5 }, { doneAt: 0 }], later: { a: L.localMin(now) - 1, b: L.localMin(now) + 30 }, pin: { id: 'x', date: '2026-11-02' } };
  L.purge(s, now);
  eq([s.tasks.length, s.musts.length, Object.keys(s.later), s.pin.id], [2, 1, ['b'], '']);
  const t = { pin: { id: 'y', date: '2026-11-04' }, tasks: [], musts: [] };
  L.purge(t, now);
  eq(t.pin.id, 'y', 'головна справа на завтра лишається');
});

test('Резервна копія: створення, перевірка, копії версій 1 і 2', () => {
  const s = L.defaultState();
  s.tasks.push(T('Звіт', 1, '2026-11-03'));
  s.musts.push(L.newMust('Рапорт'));
  s.session = session(6, 35);
  s.focus = { id: 'x', start: 5, mins: 25 };
  const backup = JSON.parse(JSON.stringify(L.makeBackup(s, 123)));
  const r = L.readBackup(backup);
  ok(r.ok);
  eq([r.summary.tasks, r.summary.musts, r.summary.steps, r.summary.items, r.exportedAt, r.state.session, r.state.focus], [1, 1, 6, 34, 123, null, null]);
  eq(L.readBackup({ app: 'other' }).ok, false);
  eq(L.readBackup({ ...backup, v: 99 }).ok, false, 'новіша версія');
  const old = L.readBackup({ app: 'opora', kind: 'backup', v: 1, exportedAt: 9, data: { tasks: [{ id: 'q', title: 'Стара', pr: 2, due: '2026-11-01' }] } });
  eq([old.ok, old.from, old.state.tasks[0].title, old.state.tools.length], [true, 1, 'Стара', 6]);
  const v2 = L.readBackup({ app: 'opora', kind: 'backup', v: 2, exportedAt: 9, data: { tasks: [{ id: 'w', title: 'Друга', pr: 1, due: '2026-11-01', cat: 'docs' }] } });
  eq([v2.ok, v2.from, v2.state.tasks[0].cat], [true, 2, 'work']);
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
