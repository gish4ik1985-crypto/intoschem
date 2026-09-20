'use strict';
// Интерфейс поверх канвы: карточка уровня, приборы, полоса цели,
// всплывающий выбор номинала, подсказка мультиметра, экран победы.
// Всё на DOM — текст должен быть текстом, а не пикселями на канве.

function el(tag, cls, parent) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (parent) parent.appendChild(node);
  return node;
}

function makeButton(label, onClick, cls = '') {
  const b = el('button', ('btn ' + cls).trim());
  b.textContent = label;
  if (onClick) b.addEventListener('click', () => {
    playSound(Audio.click);
    onClick();
  });
  return b;
}

function playSound(fn) { try { fn(); } catch(_) {} }

function uiLayer() { return document.getElementById('ui-layer'); }

// Кнопка возврата — одна и та же по месту и виду во всех сценах.
function makeBackButton(label, onClick) {
  const b = makeButton(label, onClick, 'btn-ghost btn-back');
  return b;
}

// --- Всплывающий выбор: ящик деталей открывается У ТОЙ ДЕТАЛИ, которую
// меняешь, а не отдельной панелью внизу экрана. Так виден и выбор, и то,
// на что он влияет.
const Picker = (() => {
  let node = null;

  function close() {
    if (node) { node.remove(); node = null; }
  }

  function open(screenPos, title, options, onPick, currentValue) {
    close();
    node = el('div', 'picker', uiLayer());
    node.addEventListener('mousedown', (e) => e.stopPropagation());
    const head = el('div', 'picker-title', node);
    head.textContent = title;
    const grid = el('div', 'picker-grid', node);
    for (const opt of options) {
      const b = el('button', 'picker-item', grid);
      b.innerHTML = '<span class="picker-label">' + opt.label + '</span>'
        + (opt.note ? '<span class="picker-note">' + opt.note + '</span>' : '');
      if (opt.value === currentValue && opt.kind === undefined) b.classList.add('is-current');
      if (opt.current) b.classList.add('is-current');
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        playSound(Audio.click);
        onPick(opt);
        close();
      });
    }
    // Позиционируем сразу, а не на следующем кадре: обращение к
    // offsetWidth само дожимает раскладку, и список не мигает в углу.
    // Размер с учётом роста интерфейса на маленьком экране (--k, main.js):
    // рост идёт от левого верхнего угла, и без него список вылезал бы за край.
    // screenPos — координаты холста; холст опущен внутри сцены на UI_DY,
    // а сцена может быть выше 900 (main.js, applyStageHeight).
    const k = window.UI_K || 1, dy = window.UI_DY || 0, sh = window.UI_SH || 900;
    const w = node.offsetWidth * k, h = node.offsetHeight * k;
    node.style.left = clamp(screenPos.x - w / 2, 12, 1600 - w - 12) + 'px';
    node.style.top = clamp(screenPos.y + dy - h - 26, 12, sh - h - 12) + 'px';
  }

  function isOpen() { return !!node; }
  return { open, close, isOpen };
})();

// --- Подсказка под курсором: что за деталь и что на ней прямо сейчас.
const Tip = (() => {
  let node = null;
  function show(screenPos, title, rows) {
    if (!node) node = el('div', 'tip', uiLayer());
    let html = '<div class="tip-title">' + title + '</div>';
    for (const r of rows) {
      html += '<div class="tip-row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>';
    }
    node.innerHTML = html;
    node.style.display = '';
    const k = window.UI_K || 1, dy = window.UI_DY || 0, sh = window.UI_SH || 900;
    const w = (node.offsetWidth || 160) * k, h = (node.offsetHeight || 60) * k;
    node.style.left = clamp(screenPos.x + 18, 8, 1600 - w - 8) + 'px';
    node.style.top = clamp(screenPos.y + dy - h - 14, 8, sh - h - 8) + 'px';
  }
  function hide() { if (node) node.style.display = 'none'; }
  function drop() { if (node) { node.remove(); node = null; } }
  return { show, hide, drop };
})();

// --- Карточка уровня + приборы + цель ------------------------------------

function buildLevelHud(spec, callbacks) {
  const layer = uiLayer();
  const hud = {};

  // Верхняя панель навигации.
  const nav = el('div', 'nav', layer);
  nav.appendChild(makeButton('Пауза', () => openPause(), 'btn-ghost'));
  nav.appendChild(makeButton('Кодекс', callbacks.onCodex, 'btn-ghost'));
  nav.appendChild(makeButton('Журнал', () => Journal.open(), 'btn-ghost'));
  nav.appendChild(makeBackButton('← На карту', callbacks.onBack));

  // Кнопка звука
  const soundBtn = makeButton('🔊', () => {
    const on = Audio.toggle();
    soundBtn.textContent = on ? '🔊' : '🔇';
  }, 'btn-ghost');
  soundBtn.title = 'Вкл/выкл звук';
  nav.appendChild(soundBtn);

  // Карточка «что за прибор и что с ним не так».
  const card = el('div', 'card card-brief', layer);
  const head = el('div', 'card-head', card);
  const chip = el('span', 'chip', head);
  chip.textContent = (Journal.isBench(spec) ? 'СБОРКА ' : 'УЗЕЛ ') + spec.codename;
  const teach = el('span', 'chip chip-teach', head);
  teach.textContent = spec.teaches;
  // Голос ремонтной подсистемы (см. логлайн, раздел 01 концепта) — короткая
  // строка диагностики перед описанием прибора, а не только техничный бриф.
  if (spec.diag) el('div', 'card-diag', card).textContent = spec.diag;
  // Название узла скрыто, пока узел не работает: назначение записано в его
  // собственной памяти и читается только после восстановления. Скрыто ровно
  // это — задача, приборы и подсказки на месте целиком (см. scenes/journal.js).
  const known = Journal.nameKnown(spec);
  const titleEl = el('div', 'card-title' + (known ? '' : ' is-unknown'), card);
  titleEl.textContent = known ? spec.title : 'НАЗНАЧЕНИЕ НЕ ОПРЕДЕЛЕНО';
  // Задача — первое, что видно, и крупным шрифтом: игрок должен понять,
  // что делать, не дочитывая рассказ про прибор до конца.
  el('div', 'card-task', card).textContent = 'Задача: ' + spec.goalText;
  el('div', 'card-brief-text', card).textContent = spec.brief;

  hud.status = el('div', 'status', card);

  // Подсказки — по нарастающей, по одной за нажатие. Игрок сам решает,
  // хочет он думать сам или получить прямой ответ.
  let hintsShown = 0;
  const hintBox = el('div', 'hint-box', card);
  const hintBtn = makeButton('Подсказка', () => {
    if (hintsShown >= spec.hints.length) return;
    const line = el('div', 'hint-line', hintBox);
    line.textContent = spec.hints[hintsShown];
    hintsShown += 1;
    if (hintsShown >= spec.hints.length) hintBtn.disabled = true;
    hintBtn.textContent = hintsShown >= spec.hints.length ? 'Подсказок больше нет' : 'Ещё подсказка';
  }, 'btn-small btn-ghost');
  card.appendChild(hintBtn);

  // Приборы: живые показания. Это то, чем игрок реально «щупает» схему.
  const meter = el('div', 'card card-meter', layer);
  el('div', 'card-title-small', meter).textContent = 'Приборы';
  hud.meterRows = el('div', 'meter-rows', meter);

  // Цель — отдельная полоса внизу: условие и сколько его уже держим.
  const goal = el('div', 'goal', layer);
  hud.goalText = el('div', 'goal-text', goal);
  const track = el('div', 'goal-track', goal);
  hud.goalFill = el('div', 'goal-fill', track);
  hud.goalNote = el('div', 'goal-note', goal);

  // Кнопка появляется только когда есть что менять — сгоревшую деталь.
  hud.repairBtn = makeButton('Заменить сгоревшее', callbacks.onRepair, 'btn-danger btn-repair');
  hud.repairBtn.style.display = 'none';
  layer.appendChild(hud.repairBtn);

  hud.setStatus = (msgText, tone) => {
    hud.status.textContent = msgText;
    hud.status.className = 'status status-' + (tone || 'neutral');
  };

  let lastMeterKey = '';
  hud.setMeter = (rows) => {
    const key = rows.map((r) => r[0] + r[1] + (r[2] || '')).join('|');
    if (key === lastMeterKey) return;
    lastMeterKey = key;
    hud.meterRows.innerHTML = rows.map((r) =>
      '<div class="meter-row' + (r[2] ? ' is-' + r[2] : '') + '"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
  };

  hud.setGoal = (goalTextValue, progress, note, done) => {
    hud.goalText.textContent = goalTextValue;
    hud.goalFill.style.width = Math.round(clamp(progress, 0, 1) * 100) + '%';
    hud.goalNote.textContent = note || '';
    goal.classList.toggle('is-done', !!done);
  };

  return hud;
}

// Экран «прибор заработал». Не всплывашка «победа», а отчёт: что именно
// теперь работает, насколько хорошо и что это даёт на карте.
function showWinOverlay(spec, result, callbacks) {
  playSound(Audio.win);
  const layer = uiLayer();
  const back = el('div', 'overlay', layer);
  // Esc не должен закрывать победный экран мимо кнопок «Дальше»/«На карту»
  // (см. onKeyDown в main.js).
  back.dataset.modal = 'win';
  const win = el('div', 'win-card', back);
  el('div', 'win-kicker', win).textContent = Journal.isBench(spec)
    ? 'Сборка ' + spec.codename + ' собрана · записка прочитана'
    : 'Узел ' + spec.codename + ' восстановлен · память прочитана';
  el('div', 'win-title', win).textContent = spec.title;

  // Строка из журнала изделия — единственное, что этот узел мог рассказать.
  const rev = Journal.revealOf(spec);
  if (rev) el('div', 'win-reveal', win).textContent = rev;

  const bar = el('div', 'win-score', win);
  el('div', 'win-score-label', bar).textContent = 'Отдача прибора';
  const track = el('div', 'goal-track', bar);
  const fill = el('div', 'goal-fill', track);
  fill.style.width = Math.round(result.score * 100) + '%';
  el('div', 'win-score-note', bar).textContent = result.scoreNote;

  el('div', 'win-lesson', win).textContent = spec.lesson;

  const row = el('div', 'win-buttons', win);
  // Кнопка называет следующий прибор поимённо: «Дальше» само по себе не
  // говорит, куда именно, и после уровня игрок терялся.
  row.appendChild(makeButton(
    result.next ? 'Дальше: ' + result.next.title : 'На карту платы',
    () => { back.remove(); callbacks.onNext(); }, 'btn-primary'));
  if (result.next && callbacks.onMap) {
    row.appendChild(makeButton('На карту', () => { back.remove(); callbacks.onMap(); }, 'btn-ghost'));
  }
  row.appendChild(makeButton('Остаться', () => back.remove(), 'btn-ghost'));
  return back;
}

// Кнопка режима обзора карты. Он ничего не проходит за игрока и ничего не
// открывает: прогресс, названия узлов и журнал остаются как были — на карте
// просто перестают быть невидимыми те узлы, до которых свет ещё не дошёл.
// Нужна затем, чтобы можно было посмотреть, сколько всего узлов и как они
// разложены, не проходя игру заново.
function makeRevealAllButton(afterToggle) {
  const label = () => (GameConfig.revealAll ? 'Скрыть неоткрытые узлы' : 'Показать все узлы на карте');
  const b = makeButton(label(), () => {
    GameConfig.setRevealAll(!GameConfig.revealAll);
    b.textContent = label();
    if (afterToggle) afterToggle();
  }, 'btn-ghost');
  return b;
}

// --- Пауза ----------------------------------------------------------------
// Обязательная мебель, которой не было вовсе: игра шла всегда, выйти можно
// было только через кнопки в углу конкретной сцены, а клавиша Esc не
// делала ничего.

// Страница не может закрыть чужую вкладку браузера — это ограничение
// безопасности, не наша недоделка. `window.close()` тихо срабатывает
// только для вкладок, которые сам скрипт и открыл; обычную вкладку он
// не тронет и не пожалуется. Поэтому кнопка «Выход» не претендует на то,
// чего не может: она пробует закрыть и сразу же честно показывает, что
// делать руками, если ничего не произошло.
function showExitHint() {
  const back = el('div', 'overlay', uiLayer());
  const card = el('div', 'win-card', back);
  card.style.width = '380px';
  el('div', 'win-kicker', card).textContent = 'Выход';
  el('div', 'win-title', card).textContent = 'Закрой вкладку';
  const body = el('div', 'win-lesson', card);
  body.style.textAlign = 'center';
  body.innerHTML = 'Браузер не даёт странице закрыть саму себя — так устроена безопасность браузера, не мы так решили.'
    + '<br><br>Нажми <b>Ctrl+W</b> (на Mac — <b>Cmd+W</b>) или закрой вкладку крестиком.'
    + '<br><br><span style="color:#8c99ad">Прогресс уже сохранён — можно закрывать спокойно.</span>';
  const row = el('div', 'win-buttons', card);
  row.appendChild(makeButton('Понятно', () => back.remove(), 'btn-primary'));
  return back;
}

function attemptExit() {
  window.close();
  showExitHint();
}

function showPauseOverlay(callbacks) {
  const back = el('div', 'overlay', uiLayer());
  const card = el('div', 'win-card', back);
  card.style.width = '420px';
  el('div', 'win-kicker', card).textContent = 'Пауза';
  el('div', 'win-title', card).textContent = 'Into Schem';

  const box = el('div', 'menu-buttons', card);
  box.style.margin = '0 auto 18px';
  box.appendChild(makeButton('Продолжить', () => callbacks.onResume(), 'btn-primary'));
  if (callbacks.onMap) box.appendChild(makeButton('На карту платы', callbacks.onMap, 'btn-ghost'));
  box.appendChild(makeButton('Журнал изделия', () => Journal.open(), 'btn-ghost'));
  box.appendChild(makeButton('Как это работает', () => showHowToOverlay(), 'btn-ghost'));
  // Пересобираем карту после переключения: её шапка считается один раз при
  // входе, и без пересборки счётчик остался бы от прежнего режима.
  box.appendChild(makeRevealAllButton(() => {
    if (SceneManager.current === MapScene) SceneManager.goto(MapScene);
  }));
  box.appendChild(makeButton('В главное меню', callbacks.onMenu, 'btn-ghost'));
  box.appendChild(makeButton(
    document.fullscreenElement ? 'Выйти из полноэкранного' : 'Полноэкранный режим',
    () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
      callbacks.onResume();
    }, 'btn-ghost'));
  box.appendChild(makeButton('Выход', () => attemptExit(), 'btn-ghost'));

  const note = el('div', 'win-score-note', card);
  note.style.textAlign = 'center';
  note.textContent = 'Прогресс сохраняется сам.';
  return back;
}

// Общий текст «как играть» — раньше жил только внутри MenuScene и был
// недоступен, если игрок пропустил его в главном меню и забыл, как
// крутится ручка или откуда берётся свет на карте. Теперь одна и та же
// функция открывается и из меню, и из паузы внутри любого уровня.
function showHowToOverlay() {
  const back = el('div', 'overlay', uiLayer());
  const card = el('div', 'win-card', back);
  card.style.width = '600px';
  el('div', 'win-kicker', card).textContent = 'Как это работает';
  el('div', 'win-title', card).textContent = 'Три правила';
  const body = el('div', 'win-lesson', card);
  body.innerHTML = [
    '<b>1. Схема настоящая.</b> Под игрой считается честная цепь. Ничего не подыгрывает: если ты соберёшь схему, которая в жизни сожгла бы деталь, — здесь она тоже сгорит.',
    '<b>2. Работать руками.</b> Детали на плате кликаются. Гнездо — выбрать, что вставить. Ключ — щёлкнуть. Ручка — крутить колесом мыши или тянуть.',
    '<b>3. Свет идёт только от тока.</b> Плата тёмная. Каждый починенный прибор освещает вокруг себя кусок карты — и в этом свете становятся видны следующие. Настроил вполсилы — открыл вдвое меньше.',
    '<span style="color:#8c99ad">Наведи курсор на любую деталь — увидишь, что на ней прямо сейчас: напряжение, ток, мощность, нагрев.</span>',
  ].join('<br><br>');
  const row = el('div', 'win-buttons', card);
  row.appendChild(makeButton('Понятно', () => back.remove(), 'btn-primary'));
  return back;
}
