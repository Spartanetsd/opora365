// ОПОРА 365 — «Статистика»: якість тижня однією таблицею й одна порада.
// Лише те, що позначено в застосунку; порівняння — з попередніми 7 днями. Жодних балів і рейтингів.
import * as L from './logic.js';
import { esc, icon } from './ui.js';
import { photoHead, emptyState } from './components.js';

// «4 з 5», «12 хв» не розриваються між рядками.
const nb = (s) => esc(s).replace(/(\d) з (\d)/g, '$1&nbsp;з&nbsp;$2').replace(/(\d) (хв|год|днів|дня|справ|справи)/g, '$1&nbsp;$2');

// Клітинка: «4 з 5», число або «—», коли даних немає (до першого дня користування чи без жодного випадку).
const NONE = '<span aria-hidden="true">—</span><span class="vh">немає даних</span>';
function cell(row, active) {
  if (!active) return NONE;
  if ('of' in row) return row.of ? `${row.n}&nbsp;з&nbsp;${row.of}` : NONE;
  return String(row.n);
}

function adviceBtn(b) {
  if (!b) return '';
  const data = ['tab', 'cat', 'due'].filter((k) => b[k]).map((k) => ` data-${k}="${esc(b[k])}"`).join('');
  return `<button type="button" class="btn btn-tinted advice-btn" data-act="${esc(b.act)}"${data}>${esc(b.label)}</button>`;
}

function render(app) {
  const st = L.lifeStats(app.state, Date.now());
  const range = `${L.dayMonth(st.cur.from)} — ${L.dayMonth(st.cur.to)}`;
  if (!st.any) {
    return `<div class="page">
      ${photoHead({ title: 'Статистика', sub: range })}
      ${emptyState({ ic: 'chart', title: 'Тут зʼявиться ваш тиждень', text: 'Позначайте зроблене — кроки ранку, справи, вечірній підсумок. За кілька днів тут буде таблиця й одна порада.' })}
    </div>`;
  }
  const a = st.advice;
  const rows = L.QUALITY.map((q) => `<tr${a.row === q.id ? ' class="is-focus"' : ''}>
      <th scope="row">${esc(q.name)}</th>
      <td class="wk-cur">${cell(st.cur.rows[q.id], st.cur.active)}</td>
      <td class="wk-prev">${cell(st.prev.rows[q.id], st.prev.active)}</td>
    </tr>`).join('');
  // Спершу одне головне — порада, під нею докази — таблиця.
  return `<div class="page">
    ${photoHead({ title: 'Статистика', sub: range })}
    <section class="section" aria-labelledby="advH">
      <div class="sec-row"><h2 class="sec-h" id="advH">Порада тижня</h2></div>
      <div class="advice" data-id="${esc(a.id)}">
        <span class="advice-ic" aria-hidden="true">${icon(a.icon)}</span>
        <div class="advice-body">
          <p class="advice-fact">${nb(a.fact)}</p>
          <p class="advice-act">${nb(a.act)}</p>
          ${adviceBtn(a.btn)}
        </div>
      </div>
    </section>
    <section class="section" aria-labelledby="wkH">
      <div class="sec-row"><h2 class="sec-h" id="wkH">Якість тижня</h2></div>
      <div class="wk-card">
        <table class="wk">
          <thead><tr><th scope="col"><span class="vh">Дія</span></th><th scope="col">Цей тиждень</th><th scope="col">Минулий</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
    <details class="how wk-how">
      <summary>Як рахуємо${icon('down')}</summary>
      <ul>${L.QUALITY.map((q) => `<li><b>${esc(q.name)}</b> — ${esc(q.how)}.</li>`).join('')}</ul>
      <p>Тиждень — останні 7 днів разом із сьогоднішнім, минулий — 7 днів перед ним. Лише те, що позначено в застосунку; скасоване не рахується. Порада — про найслабше місце тижня, і лише коли даних досить.</p>
    </details>
  </div>`;
}

const backdrop = () => ({ src: 'abstract-04.webp', kind: 'band', pos: 'center 35%' });

export default { title: 'Статистика', render, backdrop, actions: {} };
