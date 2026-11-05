// ОПОРА 365 — вітальний екран першого запуску: одна сторінка про філософію, без обовʼязкового навчання.
// Зображення — окремо, як предмет на сцені; текст — під ним, на спокійному тлі; одна головна дія.
import { esc, icon, openScreen, closeScreen } from './ui.js';

// Пʼять запитань, на які відповідає застосунок. Відповіді — у самому застосунку.
const POINTS = [
  { ic: 'sun', q: 'Що зараз найважливіше?' },
  { ic: 'pin', q: 'Що я можу забути?' },
  { ic: 'shieldCheck', q: 'Що потрібно перевірити?' },
  { ic: 'chevrons', q: 'Плани раптово змінилися?' },
  { ic: 'moon', q: 'Що зроблено, а що залишилося?' },
];

function html() {
  return `<div class="scr welcome-scr">
    <div class="welcome-hero" aria-hidden="true"><img src="onboarding.webp" alt="" decoding="async"></div>
    <div class="welcome-body">
      <h1 class="welcome-title" tabindex="-1" data-focus>ОПОРА 365</h1>
      <p class="welcome-lead">Менше часу на організацію.<br>Більше — на життя.</p>
      <ul class="welcome-points">${POINTS.map((p) => `<li><span class="welcome-ic">${icon(p.ic)}</span>${esc(p.q)}</li>`).join('')}</ul>
      <div class="welcome-acts">
        <button type="button" class="btn btn-primary btn-xl btn-block" data-act="welcomeStart">Почати</button>
        <button type="button" class="welcome-link" data-act="welcomeMorning">Спершу налаштувати ранок</button>
        <p class="welcome-note">Дані зберігаються лише на цьому пристрої.</p>
      </div>
    </div>
  </div>`;
}

export function openWelcome(app) {
  openScreen(html(), {
    label: 'Вітаємо в ОПОРА 365',
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
