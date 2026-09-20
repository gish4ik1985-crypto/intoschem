'use strict';
// Карта платы. Тёмная по умолчанию: единственный источник света здесь —
// приборы, которые ты уже заставил работать. Куда дотянулся свет, туда и
// можно идти чинить дальше.

const MapScene = (() => {
  let camera = vec(0, 0);
  function playSound(fn) { try { fn(); } catch(_) {} }
  let zoom = 1.35;          // >1 — камера видит больше платы
  // Верхний предел отъезда поднят с 3.0: на трёх карта уже не помещалась
  // целиком по высоте, а режим обзора для того и нужен, чтобы увидеть её всю.
  const ZOOM_MIN = 0.6, ZOOM_MAX = 4.2;
  // Раньше был константой (1000, 750) — и её тихо переросли уровни 16 и
  // 17, оказавшиеся дальше от центра карты, чем этот предел: камеру
  // заклинивало на границе, и до дальнего модуля можно было дотянуться
  // только зумом, а не перетаскиванием. Считаем от фактических позиций
  // модулей, чтобы предел сам расширялся вместе с картой, а не отставал
  // от неё до следующей жалобы. Не константа уровня модуля: LevelRegistry
  // на момент разбора этого файла ещё пуст (map.js подключён раньше
  // уровней в index.html) — считаем лениво, при первом обращении.
  let _panLimit = null;
  let _plate = null;
  // Подложка платы. Была константой (3800×2600) и перестала накрывать карту,
  // как только модули уехали за её кромку: узлы висели прямо на фоне, без
  // платы под ними. Считаем от фактических позиций — тем же способом, что и
  // предел панорамы, и по той же причине: константа отстаёт от карты до
  // следующей жалобы.
  function plateRect() {
    if (_plate) return _plate;
    const list = LevelRegistry.list.filter((sp) => sp.map);
    const pad = 420;
    const xs = list.map((sp) => sp.map.pos.x), ys = list.map((sp) => sp.map.pos.y);
    const x0 = Math.min.apply(null, xs.concat(-900)) - pad;
    const x1 = Math.max.apply(null, xs.concat(900)) + pad;
    const y0 = Math.min.apply(null, ys.concat(-600)) - pad;
    const y1 = Math.max.apply(null, ys.concat(600)) + pad;
    _plate = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    return _plate;
  }
  function panLimit() {
    if (_panLimit) return _panLimit;
    const list = LevelRegistry.list.filter((s) => s.map);
    const margin = 250; // запас, чтобы модуль не оказался ровно у кромки экрана
    const maxX = list.reduce((m, s) => Math.max(m, Math.abs(s.map.pos.x)), 600) + margin;
    const maxY = list.reduce((m, s) => Math.max(m, Math.abs(s.map.pos.y)), 600) + margin;
    _panLimit = vec(maxX, maxY);
    return _panLimit;
  }

  let dragging = false, dragMoved = 0, lastMouse = vec(0, 0);
  let mouse = vec(-9999, -9999);
  let hover = null;
  let pinch = null;         // жест двумя пальцами (engine/touch.js)
  let glow = {};            // id -> сглаженный радиус света
  let head = null;
  let _lastTipKey = '';     // содержимое Tip перестраиваем только при смене

  function devices() { return LevelRegistry.list.filter((s) => s.map); }

  // `map.from` — либо один id, либо список. Один разбор на всю сцену, чтобы
  // не забыть про список в каком-нибудь одном месте (свет открылся, а кабель
  // не нарисовался — ровно та рассинхронизация, что уже была в этом файле).
  function parentsOf(d) {
    const f = d.map.from;
    if (!f) return [];
    const ids = Array.isArray(f) ? f : [f];
    return ids.map((id) => LevelRegistry.byId(id)).filter((s) => s && s.map);
  }

  function worldToScreen(p) { return vec(800 + (p.x - camera.x) / zoom, 450 + (p.y - camera.y) / zoom); }
  function screenToWorld(p) { return vec(camera.x + (p.x - 800) * zoom, camera.y + (p.y - 450) * zoom); }

  function lightAt(point, excludeId) {
    let best = 0;
    for (const d of devices()) {
      if (d.id === excludeId) continue;
      const r = glow[d.id] || 0;
      if (r <= 1) continue;
      // Свет спадает по всему радиусу, а не только у самой кромки:
      // иначе прибор, доведённый до нижней границы допуска, не
      // дотягивается до соседа вообще, и карта выглядит сломанной.
      const dist = distV(point, d.map.pos);
      best = Math.max(best, clamp(1.15 - dist / Math.max(r, 1), 0, 1));
    }
    return best;
  }

  // Прибор открывает СВОЙ участок платы, а не всю её: смотрим только на
  // свет того прибора, от которого к этому идёт кабель. Иначе один яркий
  // светодиод в центре засвечивал бы половину карты сразу и вся идея
  // «куда подсветил, туда и пошёл» переставала бы работать.
  // Честная видимость: узел открыт светом соседа или уже работает. Именно она
  // решает, что показывать в статусе и куда ставить камеру, — режим обзора на
  // это влиять не должен, иначе шапка начнёт врать про «ждут ремонта».
  function isLit(d) {
    if (d.map.start) return true;
    if (GameConfig.isRepaired(d.id)) return true;
    // Узел, которого нет в описи, открывается не светом соседа, а тем, что
    // игрок снял все шесть неучтённых токов. Кабеля к нему нет и быть не
    // может: он и питался тем, что подворовывал с чужих шин.
    if (d.map.needs) return d.map.needs.every((id) => GameConfig.isRepaired(id));
    // Родителей может быть несколько: к узлу подводят линии с разных сторон,
    // и открыть его достаточно любой из них. Именно это делает карту схемой,
    // а не коридором: до одного и того же узла можно дойти разными путями.
    for (const src of parentsOf(d)) {
      const r = glow[src.id] || 0;
      if (r > 1 && distV(d.map.pos, src.map.pos) < r * 1.13) return true;
    }
    return false;
  }

  // Что рисовать. В режиме обзора — всё: он и заведён затем, чтобы увидеть,
  // сколько узлов на плате и как они разложены.
  function isVisible(d) { return GameConfig.revealAll || isLit(d); }

  // Прибор «доступен» — открыт светом, но ещё не работает. Именно на них
  // игрок и должен смотреть, возвращаясь на карту.
  function available() {
    return devices().filter((d) => isLit(d) && !GameConfig.isRepaired(d.id));
  }

  function mount() {
    camera = vec(0, 0);
    zoom = 1.35;
    dragging = false;
    hover = null;
    glow = {};
    for (const d of devices()) {
      glow[d.id] = GameConfig.getDeviceOutput(d.id) * d.map.radius;
    }

    // Камера открывается не в начале координат, а на том приборе, который
    // сейчас имеет смысл чинить: иначе игрок возвращается с уровня и видит
    // темноту там, где уже всё сделано, и не понимает, куда идти.
    const todo = available();
    if (todo.length) camera = vec(todo[0].map.pos.x, todo[0].map.pos.y);
    // В режиме обзора смотреть на «ближайший к ремонту» незачем — туда идут,
    // когда играют. Обзор открывается на середине всей платы и сразу
    // отъезжает так, чтобы она поместилась целиком.
    if (GameConfig.revealAll) {
      const r = plateRect();
      camera = vec(r.x + r.w / 2, r.y + r.h / 2);
      zoom = clamp(Math.max(r.w / 1600, r.h / 900), ZOOM_MIN, ZOOM_MAX);
    }

    const layer = uiLayer();
    const nav = el('div', 'nav', layer);
    nav.appendChild(makeButton('Пауза', () => openPause(), 'btn-ghost'));
    nav.appendChild(makeButton('Журнал', () => Journal.open(), 'btn-ghost'));
    nav.appendChild(makeBackButton('← В меню', () => SceneManager.goto(MenuScene)));

    head = el('div', 'card ui-tl', layer);
    head.style.left = '24px';
    head.style.top = '24px';
    head.style.width = '320px';
    el('div', 'card-title', head).textContent = 'Плата';
    el('div', 'card-brief-text', head).textContent =
      'Каждый работающий прибор светит на плату сам. В его свете становится видно следующие.';
    const st = el('div', 'status', head);
    if (todo.length) {
      st.className = 'status status-warn';
      st.textContent = 'Ждут ремонта: ' + todo.length
        + '. Ближайший — «' + Journal.displayTitle(todo[0]) + '», он сейчас в центре экрана.';
    } else {
      st.className = 'status status-good';
      st.textContent = 'Все открытые приборы работают. Осмотри плату: в их свете могло появиться что-то ещё.';
    }
    const tally = el('div', 'card-brief-text', head);
    tally.style.marginTop = '8px';
    tally.textContent = 'Работает: ' + GameConfig.repairedCount() + ' из ' + devices().length + '.'
      + (GameConfig.revealAll ? ' Режим обзора: показаны все узлы, включая ещё не открытые.' : '');

    const hint = el('div', 'map-hint', layer);
    hint.textContent = 'Тяни — осмотреть · колесо или два пальца — приблизить · нажми на прибор — войти · Esc — пауза';

    pinch = createPinch({
      start() { dragging = false; },
      change(ratio, mid, shift) {
        // Карта зумит наоборот: zoom — сколько мировых единиц в пикселе,
        // поэтому пальцы врозь (ratio > 1) — zoom меньше.
        const s = stageCoords({ clientX: mid.x, clientY: mid.y });
        const scale = document.getElementById('stage').getBoundingClientRect().width / 1600;
        const before = screenToWorld(s);
        zoom = clamp(zoom / ratio, ZOOM_MIN, ZOOM_MAX);
        const after = screenToWorld(s);
        const lim = panLimit();
        camera.x = clamp(camera.x + (before.x - after.x) - shift.x / scale * zoom, -lim.x, lim.x);
        camera.y = clamp(camera.y + (before.y - after.y) - shift.y / scale * zoom, -lim.y, lim.y);
      },
    });
    const stage = document.getElementById('stage');
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    stage.addEventListener('wheel', onWheel, { passive: false });
  }

  function unmount() {
    const stage = document.getElementById('stage');
    window.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    if (pinch) pinch.reset();
    stage.removeEventListener('wheel', onWheel);
    Tip.drop();
  }

  // Мышь, палец и перо — одно событие pointer*. Жест двумя пальцами (зум и
  // сдвиг карты) — отдельно, у мыши для него колесо. Пока жест не закончился,
  // оставшийся палец не должен считаться кликом по прибору.
  function onPointerDown(e) {
    if (pinch.down(e)) return;
    onDown(e);
  }
  function onPointerMove(e) {
    if (pinch.move(e)) return;
    onMove(e);
  }
  function onPointerUp(e) {
    if (pinch.up(e)) return;
    onUp(e);
  }
  function onPointerCancel(e) {
    pinch.up(e);
    dragging = false;
  }

  function stageCoords(e) {
    // От холста, а не от сцены: на высоком экране холст опущен внутри неё.
    const rect = document.getElementById('world').getBoundingClientRect();
    const scale = rect.width / 1600;
    return vec((e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale);
  }

  function onDown(e) {
    const id = e.target && e.target.id;
    if (e.button !== 0 || (id !== 'world' && id !== 'stage')) return;
    dragging = true;
    dragMoved = 0;
    lastMouse = vec(e.clientX, e.clientY);
    // У пальца нет «наведения»: без этого тап по прибору не находил бы, куда
    // входить (hover считался только по движению мыши), и подсказка не
    // открывалась бы вовсе.
    mouse = stageCoords(e);
    updateHover();
  }

  function updateHover() {
    const w = screenToWorld(mouse);
    hover = null;
    for (const d of devices()) {
      if (!isVisible(d)) continue;
      if (Math.abs(w.x - d.map.pos.x) < 82 && Math.abs(w.y - d.map.pos.y) < 58) hover = d;
    }
  }

  function onMove(e) {
    mouse = stageCoords(e);
    if (dragging) {
      const stage = document.getElementById('stage');
      const scale = stage.getBoundingClientRect().width / 1600;
      const dx = (e.clientX - lastMouse.x) / scale;
      const dy = (e.clientY - lastMouse.y) / scale;
      lastMouse = vec(e.clientX, e.clientY);
      dragMoved += Math.abs(dx) + Math.abs(dy);
      const lim = panLimit();
      camera.x = clamp(camera.x - dx * zoom, -lim.x, lim.x);
      camera.y = clamp(camera.y - dy * zoom, -lim.y, lim.y);
    }
    updateHover();
    document.getElementById('world').style.cursor = hover ? 'pointer' : (dragging ? 'grabbing' : 'grab');
  }

  function onUp() {
    // Клик считаем кликом, только если камеру при этом не тащили —
    // иначе панорамирование каждый раз проваливалось бы в уровень.
    if (dragging && dragMoved < 5 && hover) {
      const target = hover;
      dragging = false;
      playSound(Audio.click);
      SceneManager.goto(target.scene);
      return;
    }
    dragging = false;
  }

  function onWheel(e) {
    // Тот же фильтр, что и у клика: колесо над карточкой «Плата» или
    // подсказкой не должно зумить карту сквозь интерфейс.
    const id = e.target && e.target.id;
    if (id !== 'world' && id !== 'stage') return;
    e.preventDefault();
    const s = stageCoords(e);
    const before = screenToWorld(s);
    zoom = clamp(zoom * Math.exp(e.deltaY * 0.0012), ZOOM_MIN, ZOOM_MAX);
    const after = screenToWorld(s);
    const lim = panLimit();
    camera.x = clamp(camera.x + (before.x - after.x), -lim.x, lim.x);
    camera.y = clamp(camera.y + (before.y - after.y), -lim.y, lim.y);
  }

  function update(dt) {
    for (const d of devices()) {
      const target = GameConfig.getDeviceOutput(d.id) * d.map.radius;
      glow[d.id] = approach(glow[d.id] || 0, target, 2.5, dt);
    }
    if (hover) {
      const out = GameConfig.getDeviceOutput(hover.id);
      // Ключ последней отрисованной подсказки: без него innerHTML
      // перестраивается каждый кадр, пока курсор стоит на приборе.
      const key = hover.id + '|' + Math.round(out * 100);
      if (key !== _lastTipKey) {
        _lastTipKey = key;
        Tip.show(worldToScreen(addV(hover.map.pos, vec(0, -60))), Journal.displayTitle(hover), [
          ['Учит', hover.teaches],
          ['Состояние', out > GameConfig.REPAIRED_THRESHOLD ? 'работает на ' + Math.round(out * 100) + '%' : 'не работает'],
        ]);
      }
    } else {
      _lastTipKey = '';
      Tip.hide();
    }
  }

  function render(ctx) {
    Board.drawBackdrop(ctx, 1600, 900);

    ctx.save();
    ctx.translate(800, 450);
    ctx.scale(1 / zoom, 1 / zoom);
    ctx.translate(-camera.x, -camera.y);

    // Большая плата под всем.
    Board.drawPlate(ctx, plateRect(), { lit: 0.1, silk: 'MAINBOARD', decorSeed: 3 });

    // Свет от работающих приборов — рисуется ДО кабелей и модулей, чтобы
    // они лежали в этом свете, а не поверх него.
    for (const d of devices()) {
      const r = glow[d.id];
      if (r <= 1) continue;
      const out = GameConfig.getDeviceOutput(d.id);
      // Видимый ореол заметно меньше радиуса открытия: карта должна
      // оставаться тёмной, а не превращаться в сплошную засветку.
      glowSpot(ctx, d.map.pos, r * 0.6, d.map.color, 0.1 + 0.13 * out);
    }

    // Кабели между приборами. Кабель к прибору рисуем, только если сам
    // прибор уже открыт светом — иначе тёмная плата выдавала бы всю
    // топологию сразу, ещё до того, как игрок дошёл светом хоть до
    // одного соседа (см. CLAUDE.md, «Свет на карте»).
    for (const d of devices()) {
      if (!isVisible(d)) continue;
      for (const src of parentsOf(d)) {
        const a = src.map.pos, b = d.map.pos;
        const litLevel = Math.min(lightAt(a, null), lightAt(b, null));
        const mid = midV(a, b);
        const pts = [a, vec(mid.x, a.y), vec(mid.x, b.y), b];
        drawTrace(ctx, pts, {
          width: 7,
          radius: 26,
          flow: GameConfig.isRepaired(src.id) && GameConfig.isRepaired(d.id) ? 0.35 : 0,
          potential: 0.35,
          energized: litLevel > 0.05,
        });
      }
    }

    for (const d of devices()) {
      if (!isVisible(d)) continue;
      drawModule(ctx, d);
    }

    ctx.restore();
    Board.vignette(ctx, 1600, 900, 0.72);
  }

  // Модуль прибора — маленькая плата с той самой деталью, которую в нём
  // чинят. Работающий модуль светится ровно настолько, насколько хорошо
  // он настроен.
  function drawModule(ctx, d) {
    const out = GameConfig.getDeviceOutput(d.id);
    const lit = clamp(lightAt(d.map.pos, d.id) + out, 0, 1);
    // Узел, который виден только из-за режима обзора, помечаем иначе:
    // пунктирная рамка «сюда можно идти» на нём соврала бы — свет до него
    // ещё не дошёл.
    const preview = !isLit(d);
    const p = d.map.pos;
    const w = 168, h = 114;

    ctx.save();
    ctx.globalAlpha = clamp(0.25 + lit * 0.75, 0.25, 1) * (preview ? 0.55 : 1);
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
    fillRound(ctx, p.x - w / 2, p.y - h / 2, w, h, 8, colorToCss(brighten(Pal.BOARD, lerp(0.8, 1.3, lit))));
    ctx.restore();

    const needsWork = !GameConfig.isRepaired(d.id);
    strokeRound(ctx, p.x - w / 2, p.y - h / 2, w, h, 8,
      colorToCss(hover === d ? Pal.ACCENT : (out > 0.05 ? d.map.color : Pal.BOARD_EDGE), hover === d ? 0.95 : 0.6),
      hover === d ? 2 : 1.4);

    // Пунктирная рамка вокруг того, что открыто, но ещё не работает: это
    // и есть ответ на вопрос «куда дальше».
    if (needsWork && !preview) {
      ctx.save();
      ctx.strokeStyle = colorToCss(Pal.WARN, 0.55 + 0.35 * Math.sin(clockNow() * 2.6));
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);
      ctx.lineDashOffset = -clockNow() * 26;
      roundRectPath(ctx, p.x - w / 2 - 7, p.y - h / 2 - 7, w + 14, h + 14, 11);
      ctx.stroke();
      ctx.restore();
    }

    // Сама деталь прибора — та же отрисовка, что и на уровне.
    ctx.save();
    ctx.translate(p.x, p.y - 12);
    ctx.scale(0.72, 0.72);
    const icon = d.map.icon;
    Parts[icon.kind].draw(ctx, Object.assign({ id: 'ico', pos: vec(0, 0) }, icon), {
      heat: 0, bright: out, burnt: false, flow: out * 0.6, energized: out > 0.05,
      potential: 0.5, anim: 1, spin: clockNow() * out * 6, rpm: out, charge: out, pull: out,
    });
    ctx.restore();

    // Пока узел не работает, у него есть только обозначение: назначение
    // записано в его памяти и читается после восстановления (journal.js).
    // Подписи узла рисуются на холсте и уменьшались вместе со сценой; растут
    // на коэффициент интерфейса (main.js), но не больше 1,25 — карточка узла
    // ограничена по ширине, и название длиннее не поместилось бы.
    const mk = Math.min(window.UI_K || 1, 1.25);
    text(ctx, Journal.displayTitle(d), vec(p.x, p.y + h / 2 - 22 * mk), {
      size: 13 * mk, color: colorToCss(Pal.TEXT, 0.5 + 0.5 * lit), shadow: true,
      font: needsWork ? '"Consolas", monospace' : undefined,
    });
    text(ctx, preview ? 'ещё не открыт' : (needsWork ? 'нужен ремонт' : 'работает · ' + Math.round(out * 100) + '%'),
      vec(p.x, p.y + h / 2 - 7), {
        size: 11 * mk,
        color: preview ? colorToCss(Pal.TEXT_DIM, 0.8)
          : (needsWork ? colorToCss(Pal.WARN, 0.95) : colorToCss(Pal.ACCENT, 0.9)),
        font: '"Consolas", monospace',
      });
    text(ctx, '№' + d.index, vec(p.x - w / 2 + 10, p.y - h / 2 + 12), {
      size: 10 * mk, align: 'left', color: colorToCss(Pal.SILK, 0.35), font: '"Consolas", monospace',
    });
  }

  return { mount, unmount, update, render };
})();
