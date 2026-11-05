// ОПОРА 365 — вітальний екран першого запуску: одна сторінка про філософію, без обовʼязкового навчання.
import { esc, icon, openScreen, closeScreen } from './ui.js';

const POINTS = [
  { ic: 'sun', q: 'Що зараз найважливіше?', a: 'Одна наступна дія і чому саме вона' },
  { ic: 'pin', q: 'Що я можу забути?', a: '«Не забути» на виду, доки ви не вирішите' },
  { ic: 'shieldCheck', q: 'Що потрібно перевірити?', a: 'Лише реальні статуси спорядження' },
  { ic: 'chevrons', q: 'Плани раптово змінилися?', a: 'Потрібний сценарій за один-два дотики' },
  { ic: 'moon', q: 'Що зроблено, а що залишилося?', a: 'Вечірній підсумок за хвилину' },
];

function html() {
  return `<div class="scr welcome-scr">
    <div class="welcome-space" aria-hidden="true"></div>
    <div class="welcome-body">
      <h1 class="welcome-title">ОПОРА 365</h1>
      <p class="welcome-lead">Менше часу на організацію — більше на життя.</p>
      <ul class="welcome-points">${POINTS.map((p) => `<li>${icon(p.ic)}<span><b>${esc(p.q)}</b>${esc(p.a)}</span></li>`).join('')}</ul>
      <button type="button" class="btn btn-primary btn-xl btn-block" data-act="welcomeStart" data-focus>Почати</button>
      <button type="button" class="btn btn-glass btn-block" data-act="welcomeMorning">${icon('sunrise')}Спершу налаштувати ранок</button>
      <p class="foot center">Дані зберігаються лише на цьому пристрої.</p>
    </div>
  </div>`;
}

export function openWelcome(app) {
  openScreen(html(), {
    label: 'Вітаємо в ОПОРА 365',
    bg: 'onboarding.webp',
    bgPos: 'center 24%',
    cls: 'welcome',
    onClose: () => {
      if (!app.state.settings.onboarded) app.commit((s) => { s.settings.onboarded = true; });
    },
  });
}

const actions = {
  welcomeStart(app) {
    app.commit((s) => { s.settings.onboarded = true; }, { render: false });
    closeScreen();
  },
  welcomeMorning(app) {
    app.commit((s) => { s.settings.onboarded = true; }, { render: false });
    closeScreen();
    app.go('morning');
  },
  welcomeAgain(app) {
    document.getElementById('sheet')?.close();
    setTimeout(() => openWelcome(app), 60);
  },
};

export default { actions };
