// ОПОРА 365 — «Підсумки тижня»: що вже зроблено за 7 днів. Лише факти, без оцінок і рейтингів.
import * as L from './logic.js';
import { esc, icon } from './ui.js';
import { photoHead } from './components.js';

function render(app) {
  const w = L.weekStats(app.state, Date.now());
  const today = app.today;
  const total = w.tasks + w.musts;
  const bars = w.rows.map((r) => {
    const n = r.tasks + r.musts;
    const h = Math.round((n / w.max) * 100);
    const label = `${L.weekdayName(r.date)}, ${L.dayMonth(r.date)}: виконано ${n}, перевірок ${r.checks}, сценаріїв ${r.runs}${r.closed ? ', підсумок підбито' : ''}`;
    return `<li class="bar${r.date === today ? ' is-today' : ''}" aria-label="${esc(label)}">
      <span class="bar-n" aria-hidden="true">${n || ''}</span>
      <span class="bar-col" aria-hidden="true"><span class="bar-fill" style="--h:${h}%"></span>${r.checks || r.runs ? `<span class="bar-dot" title="Перевірки або сценарії"></span>` : ''}</span>
      <span class="bar-d" aria-hidden="true">${L.WD_S[L.weekday(r.date)]}</span>
      <span class="bar-m" aria-hidden="true">${r.closed ? icon('moon') : ''}</span>
    </li>`;
  }).join('');
  const tile = (n, t, ic) => `<div class="stat"><span class="stat-ic" aria-hidden="true">${icon(ic)}</span><b class="tnum">${n}</b><span>${t}</span></div>`;
  return `<div class="page">
    ${photoHead({ title: 'Підсумки тижня', sub: `${L.dayMonth(w.rows[0].date)} — ${L.dayMonth(today)}` })}
    <section class="section stats-card" aria-labelledby="wkH">
      <div class="sec-row"><h2 class="sec-h" id="wkH">Виконано справ<span class="sec-count">${total}</span></h2></div>
      <ul class="bars" aria-label="Виконані справи по днях">${bars}</ul>
      <p class="legend-line" aria-hidden="true"><span><i class="lg-bar"></i>справи й «Не забути»</span><span><i class="lg-dot"></i>перевірки чи сценарії</span><span>${icon('moon')}підсумок дня</span></p>
    </section>
    <div class="stats">
      ${tile(total, L.plural(total, ['справа виконана', 'справи виконано', 'справ виконано']), 'checkCircle')}
      ${tile(w.checks, L.plural(w.checks, ['перевірка спорядження', 'перевірки спорядження', 'перевірок спорядження']), 'shieldCheck')}
      ${tile(w.runs, L.plural(w.runs, ['сценарій чи доручення', 'сценарії чи доручення', 'сценаріїв чи доручень']), 'chevrons')}
      ${tile(w.closed, L.plural(w.closed, ['вечірній підсумок', 'вечірні підсумки', 'вечірніх підсумків']), 'moon')}
    </div>
    <p class="foot">Лише те, що позначено в застосунку. Скасовані справи не враховуються. Виконане зберігається в архіві ${L.ARCHIVE_DAYS} днів.</p>
  </div>`;
}

const backdrop = () => ({ src: 'abstract-04.webp', kind: 'band', pos: 'center 55%' });

export default { title: 'Підсумки тижня', render, backdrop, actions: {} };
