// ОПОРА 365 — час і дати за київським часом. Чиста логіка без DOM.
// «Місцеві хвилини» (local minutes) = номер дня × 1440 + хвилина доби за Києвом.

export const DAY = 1440;

export function parseHM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s ?? '').trim());
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  return h > 23 || mi > 59 ? null : h * 60 + mi;
}

export function fmtHM(min) {
  const v = ((Math.floor(min + 1e-6) % DAY) + DAY) % DAY;
  return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
}

export function fmtDur(min) {
  const t = Math.max(0, Math.round(min));
  const h = Math.floor(t / 60), m = t % 60;
  if (!h) return `${m} хв`;
  return m ? `${h} год ${m} хв` : `${h} год`;
}

function makeFmt(place) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: place, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
}
let area = 'Europe/Kyiv';
let FMT;
try { FMT = makeFmt(area); } catch {
  try { area = 'Europe/Kiev'; FMT = makeFmt(area); } catch { area = ''; FMT = makeFmt(undefined); }
}
export const TIME_AREA = area || 'local';

export function kyivParts(ms = Date.now()) {
  const p = {};
  for (const part of FMT.formatToParts(new Date(ms))) p[part.type] = part.value;
  return { date: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute, sec: +p.second };
}
export const todayKey = (ms = Date.now()) => kyivParts(ms).date;

export function dayNum(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 864e5);
}
export function dateFromNum(n) {
  const d = new Date(n * 864e5);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
export const addDays = (key, n) => dateFromNum(dayNum(key) + n);
export const diffDays = (from, to) => dayNum(to) - dayNum(from);
export const isKey = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && dateFromNum(dayNum(s)) === s;

export function localMin(ms = Date.now()) {
  const p = kyivParts(ms);
  return dayNum(p.date) * DAY + p.min + p.sec / 60;
}
export const minOfDay = (lm) => lm - Math.floor(lm / DAY) * DAY;
export const keyOfLocal = (lm) => dateFromNum(Math.floor(lm / DAY));
export const localAt = (key, min) => dayNum(key) * DAY + min;

const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const MONTHS_S = ['січ.', 'лют.', 'бер.', 'квіт.', 'трав.', 'черв.', 'лип.', 'серп.', 'вер.', 'жовт.', 'лист.', 'груд.'];
const WEEKDAYS = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота'];
export const WD_S = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export const weekday = (key) => (((dayNum(key) + 4) % 7) + 7) % 7; // 0 — неділя
export const weekdayName = (key) => WEEKDAYS[weekday(key)];
export function dayMonth(key) {
  const [, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}
export const longDate = (key) => `${weekdayName(key)}, ${dayMonth(key)}`;
export function shortDate(key, today) {
  const diff = diffDays(today, key);
  if (diff === 0) return 'сьогодні';
  if (diff === 1) return 'завтра';
  if (diff === -1) return 'учора';
  const [, m, d] = key.split('-').map(Number);
  return `${WD_S[weekday(key)]}, ${d} ${MONTHS_S[m - 1]}`;
}

export function plural(n, [one, few, many]) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  return b >= 2 && b <= 4 ? few : many;
}
export const count = (n, forms) => `${n} ${plural(n, forms)}`;
export const daysWord = (n) => count(n, ['день', 'дні', 'днів']);

// «через 25 хв» / «зараз» / «25 хв тому»
export function relIn(delta) {
  if (Math.abs(delta) < 1) return 'зараз';
  return delta > 0 ? `через ${fmtDur(delta)}` : `${fmtDur(-delta)} тому`;
}

// Коли сталося: «сьогодні о 14:05», «учора о 09:10», «3 дні тому».
export function whenText(ms, today) {
  if (!ms) return '';
  const p = kyivParts(ms);
  const days = diffDays(p.date, today);
  if (days <= 0) return `сьогодні о ${fmtHM(p.min)}`;
  if (days === 1) return `учора о ${fmtHM(p.min)}`;
  return `${daysWord(days)} тому`;
}

export function greeting(min) {
  if (min < 300) return 'Доброї ночі';
  if (min < 660) return 'Доброго ранку';
  if (min < 1020) return 'Доброго дня';
  if (min < 1320) return 'Доброго вечора';
  return 'Доброї ночі';
}

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
