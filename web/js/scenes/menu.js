'use strict';
// Главное меню. Фон живой: по дорожкам бежит заряд — то же правило, что
// и во всей игре, свет идёт только от тока.

const MenuScene = (() => {
  let traces = [];

  function buildTraces() {
    traces = [];
    const rnd = mulberry(20240823);
    for (let i = 0; i < 13; i++) {
      const y = 60 + rnd() * 780;
      const x0 = -100 + rnd() * 400;
      const pts = [vec(x0, y)];
      let x = x0, yy = y;
      for (let s = 0; s < 3 + Math.floor(rnd() * 3); s++) {
        x += 140 + rnd() * 260;
        pts.push(vec(x, yy));
        yy += (rnd() < 0.5 ? -1 : 1) * (40 + rnd() * 90);
        pts.push(vec(x, yy));
      }
      pts.push(vec(x + 200 + rnd() * 400, yy));
      traces.push({ pts, flow: 0.05 + rnd() * 0.32, hue: 0.15 + rnd() * 0.5 });
    }
  }

  // Свой генератор псевдослучайных: фон должен быть одинаковым при каждом
  // запуске, а Math.random() каждый раз рисует новый.
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function mount() {
    if (!traces.length) buildTraces();
    const layer = uiLayer();
    const menu = el('div', 'menu', layer);
    const done = GameConfig.repairedCount();
    el('div', 'menu-title', menu).textContent = 'INTO SCHEM';
    el('div', 'menu-sub', menu).textContent = done > 0
      ? 'ремонтная подсистема · восстановлено узлов ' + done + ' из ' + LevelRegistry.list.length
      : 'ремонтная подсистема · назначение изделия не определено';

    const box = el('div', 'menu-buttons', menu);
    // Первый запуск ведёт сразу в первую сборку стенда, а не на тёмную карту:
    // карта на старте — это один светлый прямоугольник в темноте и никакого
    // объяснения, что с ним делать. Карта появляется, когда есть что смотреть.
    const first = LevelRegistry.list[0];
    box.appendChild(makeButton(done > 0 ? 'Продолжить' : 'Начать',
      () => {
        const go = () => SceneManager.goto(done > 0 || !first ? MapScene : first.scene);
        // Первый запуск — сперва безопасность, потом первая сборка.
        if (done > 0) go(); else showSafetyOverlay(go);
      }, 'btn-primary'));
    box.appendChild(makeButton('Как это работает', () => showHowToOverlay(), 'btn-ghost'));
    box.appendChild(makeButton('Безопасность', () => showSafetyOverlay(), 'btn-ghost'));
    box.appendChild(makeButton('Кодекс', () => CodexPanel.openOverlay(), 'btn-ghost'));
    box.appendChild(makeButton('Журнал изделия', () => Journal.open(), 'btn-ghost'));
    box.appendChild(makeButton('Выход', () => attemptExit(), 'btn-ghost'));

    const foot = el('div', 'menu-foot', layer);
    const total = LevelRegistry.list.length;
    el('span', '', foot).textContent = 'Узлов восстановлено: ' + done + ' из ' + total;
    foot.appendChild(makeRevealAllButton());
    foot.appendChild(makeButton('Сбросить прогресс', () => {
      if (!confirm('Стереть весь прогресс и вернуть все приборы в исходное состояние?')) return;
      GameConfig.resetProgress();
      SceneManager.goto(MenuScene);
    }, 'btn-ghost'));
  }

  function render(ctx) {
    Board.drawBackdrop(ctx, 1600, 900);
    for (const t of traces) {
      drawTrace(ctx, t.pts, { width: 5, flow: t.flow, potential: t.hue, radius: 14 });
    }
    Board.vignette(ctx, 1600, 900, 0.86);
    // Отдельное затемнение по центру: дорожки — фон, а не соперник
    // названию и кнопкам.
    const g = ctx.createRadialGradient(800, 430, 40, 800, 430, 620);
    g.addColorStop(0, 'rgba(4,6,9,0.93)');
    g.addColorStop(0.55, 'rgba(4,6,9,0.72)');
    g.addColorStop(1, 'rgba(4,6,9,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1600, 900);
  }

  return { mount, unmount() {}, update() {}, render };
})();
