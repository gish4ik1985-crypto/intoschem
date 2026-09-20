'use strict';
// Роутер сцен, главный цикл и пауза.

const SceneManager = {
  current: null,
  paused: false,
  goto(sceneModule) {
    if (this.current && this.current.unmount) this.current.unmount();
    document.getElementById('ui-layer').innerHTML = '';
    this.paused = false;
    this.current = sceneModule;
    sceneModule.mount();
  },
};

function fitStage() {
  const stage = document.getElementById('stage');
  const scale = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
  if (scale > 0) stage.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
  if (scale > 0) applyStageHeight(scale);
  if (scale > 0) applyUiBoost(scale);
}

// Экран выше 16:9 (планшет 4:3, телефон стоя) раньше давал чёрные полосы
// сверху и снизу, а панелям интерфейса при этом не хватало высоты. Теперь
// сцена растягивается на всю высоту: панели занимают полосы, а холст с платой
// остаётся посередине прежнего размера 1600×900 (#world сдвигается на
// --wy). Всё, что переводит координаты мыши или ставит DOM по координатам
// холста, обязано учитывать этот сдвиг: window.UI_DY — на сколько холст
// опущен внутри сцены, window.UI_SH — полная высота сцены.
function applyStageHeight(scale) {
  const sh = Math.max(900, Math.round(window.innerHeight / scale));
  const wy = Math.round((sh - 900) / 2);
  const root = document.documentElement.style;
  root.setProperty('--sh', sh + 'px');
  root.setProperty('--wy', wy + 'px');
  window.UI_SH = sh;
  window.UI_DY = wy;
}

// Сцена рассчитана на 1600×900 и целиком уменьшается под экран: на планшете
// 1024×768 (scale 0,64) текст в 15 px превращается в 9,6 px и не читается.
// Плату уменьшать можно — она вся видна и так, — а вот подписи, цифры и кнопки
// нет. Поэтому панели интерфейса доращиваются отдельным коэффициентом --k до
// читаемого размера (около 0,92 от натурального), каждая вокруг своего угла
// (см. «Планшет» в style.css). Потолок 1,5: дальше панели уже наезжают на плату.
// На большом окне (scale ≥ 0,92) коэффициент 1 — ничего не меняется.
// --ko — для окон по центру (победа, пауза, журнал): они большие, им хватит
// меньшего роста, иначе не поместятся по высоте.
function applyUiBoost(scale) {
  const k = Math.min(1.5, Math.max(1, 0.92 / scale));
  const ko = Math.min(1.25, k);
  const root = document.documentElement.style;
  root.setProperty('--k', k.toFixed(3));
  root.setProperty('--ko', ko.toFixed(3));
  window.UI_K = k;
  // Класс для правил, которые зависят от «крупного» режима (палитра Верстака).
  document.documentElement.classList.toggle('ui-big', k > 1.05);
}

// Esc — единая клавиша «назад»: сперва закрывает то, что открыто поверх
// сцены (кодекс, экран победы, список номиналов), и только когда закрывать
// нечего — ставит игру на паузу.
function onKeyDown(e) {
  if (e.key !== 'Escape') return;
  if (Picker.isOpen()) { Picker.close(); return; }
  // Закрываем ВЕРХНИЙ оверлей, а не первый в DOM: пауза добавлена раньше
  // всего, что открыто из неё, и querySelector всегда находил именно её —
  // Esc закрывал паузу, оставляя «Как это работает» висеть над живой игрой.
  const overlays = document.querySelectorAll('.codex, .overlay');
  if (overlays.length) {
    const top = overlays[overlays.length - 1];
    // Победный экран — отчёт с кнопками выбора, а не препятствие: Esc его
    // не трогает, чтобы «проскочить» его мимо кнопок «Дальше»/«На карту».
    if (top.dataset.modal === 'win') return;
    top.remove();
    // Снимать паузу можно только когда закрылся ПОСЛЕДНИЙ оверлей: Esc на
    // «Как это работает», открытом из паузы, должен вернуть в паузу.
    if (!document.querySelector('.codex, .overlay')) SceneManager.paused = false;
    return;
  }
  openPause();
}

function openPause() {
  SceneManager.paused = true;
  const inLevel = SceneManager.current && SceneManager.current.spec;
  showPauseOverlay({
    onResume: () => {
      const o = document.querySelector('.overlay');
      if (o) o.remove();
      SceneManager.paused = false;
    },
    onMap: inLevel ? () => SceneManager.goto(MapScene) : null,
    onMenu: () => SceneManager.goto(MenuScene),
  });
}

let _lastFrame = performance.now();

function mainLoop() {
  const now = performance.now();
  const dt = Math.min((now - _lastFrame) / 1000, 0.1);
  _lastFrame = now;

  // На паузе кадр продолжает рисоваться, но время в схеме стоит: иначе
  // конденсатор дозарядится, а деталь догорит, пока игрок читает меню.
  if (!SceneManager.paused) tickClock(dt);

  // Канва не чистится сама между кадрами: если у сцены нет своего render,
  // на ней навсегда останется последний кадр предыдущей. Чистим тут, один
  // раз на всех.
  const ctx = document.getElementById('world').getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, 1600, 900);

  if (SceneManager.current) {
    if (!SceneManager.paused && SceneManager.current.update) SceneManager.current.update(dt);
    if (SceneManager.current.render) SceneManager.current.render(ctx);
  }
  requestAnimationFrame(mainLoop);
}

window.addEventListener('resize', fitStage);
window.addEventListener('load', fitStage);
window.addEventListener('keydown', onKeyDown);
// В скрытой при первой отрисовке вкладке innerWidth/innerHeight ещё не
// готовы — тогда масштаб считается нулём и сцена схлопывается. Лишний
// вызов на следующем кадре ничего не портит.
requestAnimationFrame(fitStage);

GameConfig.load();
fitStage();
SceneManager.goto(MenuScene);
requestAnimationFrame(mainLoop);
