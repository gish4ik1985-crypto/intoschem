'use strict';
// Генератор рельсовой платы.
//
// Зачем он есть. В фиксированном уровне провода ДЕКОРАТИВНЫ: топологию задаёт
// build(), а картинку — руками набранные координаты в `wires`. Эти две вещи
// расходятся молча — ни решатель, ни лог на расхождение не реагируют никак, и
// каждый такой случай ловится потом глазами по одному. Здесь и разводка, и
// компоненты решателя строятся ИЗ ОДНОГО описания рядов, поэтому разойтись им
// физически негде.
//
// Форма платы всегда одна и та же, и это осознанно: слева блок питания, от
// него вертикальная шина VCC, справа вертикальная шина GND, между ними —
// горизонтальные ряды потребителей. Именованный узел (например «REF») — это
// ещё одна вертикальная шина между ними: к ней приходят одни ряды и от неё
// уходят другие. Так на плате и выглядит любой делитель, любая развилка и
// любая общая точка.
//
//   Rig.rows({ board, supply, rows })  -> { parts, wires }
//   Rig.build(circuit, P)              -> refs, компоненты по видам деталей
//   Rig.apply(circuit, refs, P)        -> номиналы и ключи каждый кадр

const Rig = (() => {
  const PAD = 14;      // отступ от кромки платы
  const GAP_X = 30;    // просвет между деталями в ряду
  const GAP_Y = 26;    // просвет между рядами
  const RAIL_DX = 40;  // насколько шина VCC правее клемм блока питания
  const GND_DX = 34;   // насколько шина GND левее правой кромки
  // Нижний обратный провод идёт выше шелкографии платы: она печатается в
  // правом нижнем углу по фиксированному месту (board.js, drawPlate), и
  // дорожка поверх неё — дефект, который не видно нигде, кроме экрана.
  const GND_DY = 48;

  function geom(item) {
    const probe = Object.assign({ pos: vec(0, 0) }, item);
    const t = Parts[item.kind].terminals(probe);
    const hit = Parts[item.kind].hit(probe);
    const ay = t.a ? t.a.y : 0;
    return {
      ax: t.a.x, bx: t.b.x, ty: ay,
      w: hit.w, h: hit.h,
      above: ay + hit.h / 2,
      below: hit.h / 2 - ay,
    };
  }

  function rows(cfg) {
    const board = cfg.board;
    const parts = [];
    const wires = [];
    const problems = [];
    const warn = (m) => problems.push(m);

    // Питание. Обычно это один блок питания на плате; но бывает узел, у
    // которого своего источника НЕТ — питание к нему тянут кабелями от
    // соседей (cfg.feeds). Тогда вместо блока на кромке стоят клеммники
    // ввода, у каждого своя колонка, а земля у всех общая: она приходит
    // теми же кабелями и садится на общий обратный провод платы.
    const feeds = cfg.feeds || null;
    let sup = null, supB = null, supA = null, xV = 0;
    const feedCols = {};
    if (feeds) {
      const fg = Parts.feed.hit();
      const GAP_F = 30;
      const totalH = feeds.length * fg.h + (feeds.length - 1) * GAP_F;
      const zoneTop = board.y + PAD, zoneBot = board.y + board.h - GND_DY - 20;
      let fy = (zoneTop + zoneBot) / 2 - totalH / 2 + fg.h / 2;
      feeds.forEach((f, k) => {
        const part = Object.assign({ kind: 'feed' }, f);
        part.comp = part.comp || ('V' + (k + 1));
        part.nets = [f.id, 'GND'];
        part.pos = vec(board.x + PAD + fg.w / 2, fy);
        parts.push(part);
        feedCols[f.id] = { part, plus: vec(part.pos.x + 46, part.pos.y) };
        fy += fg.h + GAP_F;
      });
      xV = Math.max.apply(null, feeds.map((f) => feedCols[f.id].plus.x)) + RAIL_DX;
    } else {
      // Блок питания. Клеммы у него на правом боку: «b» — плюс, «a» — минус.
      sup = Object.assign({ kind: 'supply', comp: 'V1', nets: ['VCC', 'GND'] }, cfg.supply);
      const sg = Parts.supply.hit(sup);
      sup.pos = vec(board.x + PAD + sg.w / 2, board.y + PAD + sg.h / 2);
      supB = vec(sup.pos.x + 64, sup.pos.y - 18); // плюс
      supA = vec(sup.pos.x + 64, sup.pos.y + 18); // минус
      parts.push(sup);
      xV = supB.x + RAIL_DX;
    }
    const xG = board.x + board.w - GND_DX;
    const yBot = board.y + board.h - GND_DY;

    // Колонки. VCC слева, GND справа, именованные узлы — между ними в порядке
    // первого упоминания. Доли по ширине можно задать вручную (cfg.busX),
    // если ряд иначе не помещается.
    const busNames = [];
    for (const row of cfg.rows) {
      for (const n of [row.from || 'VCC', row.to === undefined ? 'GND' : row.to]) {
        if (n !== 'VCC' && n !== 'GND' && busNames.indexOf(n) < 0) busNames.push(n);
      }
    }
    const col = { GND: xG };
    if (feeds) feeds.forEach((f, k) => { col[f.id] = xV + k * 42; });
    else col.VCC = xV;
    const freeBus = busNames.filter((n) => col[n] === undefined);
    const xFirst = feeds ? xV + (feeds.length - 1) * 42 : xV;
    freeBus.forEach((n, k) => {
      const frac = (cfg.busX && cfg.busX[n] !== undefined) ? cfg.busX[n] : (k + 1) / (freeBus.length + 1);
      col[n] = xFirst + (xG - xFirst) * frac;
    });

    // Раскладка рядов по вертикали.
    const info = cfg.rows.map((row, ri) => {
      const g = row.items.map(geom);
      return {
        row, ri, g,
        above: Math.max.apply(null, g.map((x) => x.above)),
        below: Math.max.apply(null, g.map((x) => x.below)),
      };
    });
    let y = 0;
    info.forEach((it, k) => {
      if (k === 0) y = Math.max(board.y + PAD + it.above, supB ? supB.y + 26 : board.y + PAD + it.above);
      else y += info[k - 1].below + GAP_Y + it.above;
      it.y = y;
    });
    // Свободное место распределяем поровну сверху и снизу: иначе один-два
    // ряда жмутся под самый блок питания, а нижняя половина платы пустая.
    {
      const topSlack = (info[0].y - info[0].above) - (board.y + PAD);
      const botSlack = (yBot - 14) - (info[info.length - 1].y + info[info.length - 1].below);
      const shift = Math.max(0, (botSlack - topSlack) / 2);
      if (shift > 1) for (const it of info) it.y += shift;
    }
    const lastBottom = info[info.length - 1].y + info[info.length - 1].below;
    if (lastBottom > yBot - 14) {
      warn('ряды не помещаются по высоте: низ ' + Math.round(lastBottom)
        + ', обратный провод на ' + Math.round(yBot));
    }

    // Отводы к вертикальной колонке. Запоминаем не только высоту, но и то,
    // КТО в этой точке вливает ток в шину и в какую сторону: ряд, ПРИХОДЯЩИЙ
    // на шину, вливает +I своей последней детали, ряд, УХОДЯЩИЙ с неё, —
    // забирает, то есть вливает −I своей первой детали. Из этих чисел
    // считается ток в каждом участке шины между соседними отводами.
    const taps = {}; // имя колонки -> [{ y, comp, sign }]
    const tap = (name, yy, comp, sign) => {
      (taps[name] = taps[name] || []).push({ y: yy, comp, sign });
    };
    const rowWires = [];

    info.forEach((it) => {
      const row = it.row;
      const from = row.from || 'VCC';
      const to = row.to === undefined ? 'GND' : row.to;
      const rated = row.rated || 0.25;
      const rowId = row.id || ('n' + it.ri);
      const xa = col[from], xb = col[to];
      if (xa === undefined || xb === undefined) { warn('ряд ' + rowId + ': неизвестная колонка'); return; }
      if (xb - xa < 60) warn('ряд ' + rowId + ': колонки «' + from + '» и «' + to + '» слишком близко');

      // Детали ставим по центру между колонками — так ряд не жмётся к одному
      // краю и просветы одинаковые слева и справа.
      let need = 0;
      it.g.forEach((g, k) => { need += g.bx - g.ax + (k ? GAP_X : 0); });
      const avail = xb - xa;
      // Просвет до колонок с каждой стороны — половина остатка. 12 px хватает
      // на короткий отвод и не даёт корпусу налезть на вертикальную шину;
      // остальное ловит проверка разводки (web/tests/layout.test.js).
      if (need > avail - 24) {
        warn('ряд ' + rowId + ': детали не помещаются (' + Math.round(need)
          + ' px при просвете ' + Math.round(avail) + ')');
      }
      let cursor = xa + (avail - need) / 2;

      const placed = [];
      row.items.forEach((raw, k) => {
        const g = it.g[k];
        const item = Object.assign({}, raw);
        // Детали с нарисованной полярностью — элемент питания, крона,
        // электролит. Ряд идёт слева направо, значит его левая сторона
        // (nets[0]) всегда ближе к плюсу; а все три детали рисуют плюс
        // СПРАВА, пока не перевёрнуты. Без этой строчки на плате нарисован
        // минус там, где в цепи плюс, — и именно это игрок читает как
        // «ток идёт от минуса к плюсу».
        if ((item.kind === 'cell' || item.kind === 'krona' || item.kind === 'capacitor')
          && item.flipped === undefined) {
          item.flipped = true;
        }
        item.pos = vec(cursor - g.ax, it.y - g.ty);
        item.comp = item.comp || item.id;
        item.nets = [
          k === 0 ? from : rowId + '_' + k,
          k === row.items.length - 1 ? to : rowId + '_' + (k + 1),
        ];
        const aPt = vec(item.pos.x + g.ax, it.y);
        const bPt = vec(item.pos.x + g.bx, it.y);
        placed.push({ item, g, aPt, bPt });
        parts.push(item);
        cursor = bPt.x + GAP_X;
      });

      const via = (k) => placed[Math.min(k, placed.length - 1)].item.comp;

      rowWires.push({ pts: [vec(xa, it.y), placed[0].aPt], net: from, via: via(0), rated });
      tap(from, it.y, via(0), -1);
      for (let k = 1; k < placed.length; k++) {
        rowWires.push({
          pts: [placed[k - 1].bPt, placed[k].aPt],
          net: placed[k].item.nets[0], via: via(k), rated,
        });
      }
      rowWires.push({
        pts: [placed[placed.length - 1].bPt, vec(xb, it.y)],
        net: to, via: via(placed.length - 1), rated,
      });
      tap(to, it.y, via(placed.length - 1), +1);
    });

    // Шины. Каждую рисует РОВНО ОДИН провод, отводы примыкают к ней
    // T-образно: две дорожки на одной линии сливаются в одну, и по картинке
    // уже не сказать, сколько там проводов и куда каждый идёт.
    const railRated = cfg.rated || 0.3;
    if (!feeds && !taps.VCC) warn('ни один ряд не питается от шины VCC');
    if (!taps.GND) warn('ни один ряд не приходит на землю');

    // dir: -1 — дорожка нарисована ОТ плюсовой клеммы наружу, а ток источника
    // отрицателен ровно тогда, когда источник отдаёт. Без этой пометки бег
    // заряда по шине питания идёт задом наперёд, к плюсу, — а по всем
    // остальным дорожкам от него. Обратная шина этого не требует: она
    // нарисована от минусовой клеммы, то есть тоже против тока, и два минуса
    // там сходятся сами.
    const ys = (name, fallback) => (taps[name] || []).map((t) => t.y).concat(fallback);
    const gx = cfg.groundX === undefined ? board.x + board.w * 0.40 : cfg.groundX;
    if (feeds) {
      // Клеммник ввода — такой же «вливающий» отвод в свою колонку, как и блок
      // питания: его ток отрицателен, когда он отдаёт. Дальше колонка строится
      // общим кодом шин, участками между отводами.
      for (const f of feeds) {
        const fc = feedCols[f.id];
        tap(f.id, fc.plus.y, fc.part.comp, -1);
        wires.push({
          pts: [fc.plus, vec(col[f.id], fc.plus.y)],
          net: f.id, via: fc.part.comp, dir: -1, rated: railRated,
        });
      }
      // Обратный провод идёт от знака земли вправо и вверх к рядам. Ток по
      // нему — сумма всего, что пришло на землю, и течёт он НАВСТРЕЧУ
      // отрисовке, к знаку земли, поэтому dir: -1.
      wires.push({
        pts: [vec(gx, yBot), vec(xG, yBot), vec(xG, Math.min.apply(null, ys('GND', [yBot])))],
        net: 'GND', dir: -1, rated: railRated,
        viaSum: (taps.GND || []).map((t) => ({ comp: t.comp, sign: t.sign })),
      });
    } else {
      wires.push({
        pts: [supB, vec(xV, supB.y), vec(xV, Math.max.apply(null, ys('VCC', [supB.y])))],
        net: 'VCC', via: 'V1', dir: -1, rated: railRated,
      });
      wires.push({
        pts: [supA, vec(supA.x, yBot), vec(xG, yBot), vec(xG, Math.min.apply(null, ys('GND', [yBot])))],
        net: 'GND', via: 'V1', rated: railRated,
      });
    }
    // Именованная шина рисуется не одной дорожкой, а участками между
    // соседними отводами: в каждом участке ток СВОЙ — это сумма всего, что
    // влилось выше. Одной деталью-«via» такую шину не описать, и раньше она
    // просто оставалась без движения при любом токе.
    // Колонки вводов уже попали в busNames (ряды начинаются с них), поэтому
    // добавляем только те, которых там нет: иначе колонка рисуется дважды, и
    // две одинаковые дорожки сливаются в одну — по картинке не сказать, что
    // их там две.
    const drawn = busNames.concat((feeds || []).map((f) => f.id).filter((n) => busNames.indexOf(n) < 0));
    for (const n of drawn) {
      const list = (taps[n] || []).slice().sort((a, b) => a.y - b.y);
      if (list.length < 2) { warn('узел «' + n + '»: к нему приходит меньше двух рядов'); continue; }
      for (let k = 0; k + 1 < list.length; k++) {
        wires.push({
          pts: [vec(col[n], list[k].y), vec(col[n], list[k + 1].y)],
          net: n, rated: railRated,
          viaSum: list.slice(0, k + 1).map((t) => ({ comp: t.comp, sign: t.sign })),
        });
      }
    }
    for (const w of rowWires) wires.push(w);

    // Знак земли сидит прямо на обратном проводе. Обратный провод при этом
    // рисуется ВСЕГДА — ток обязан вернуться, вне зависимости от значка.
    //
    // А сам значок — это НАЗВАНИЕ опорной точки, и в этой игре он почти
    // всегда лишний. Причина простая: обратный провод здесь нарисован
    // целиком, всегда, до самой клеммы источника. Значит главную свою работу
    // — заменить собой ненарисованные обратные провода — значок тут не
    // делает вообще. Остаётся ровно одна работа: назвать точку, ОТНОСИТЕЛЬНО
    // которой что-то считают. Она нужна:
    //   · когда ноль приходит кабелем снаружи (`feeds`) — своего источника у
    //     узла нет, и опору приносит сосед, назвать её больше нечем;
    //   · когда об этом сам урок — `cfg.groundSymbol` (Т-03 «Обратный
    //     провод», Т-08: точка меряется ОТНОСИТЕЛЬНО земли, В-07:
    //     сопротивление самого обратного провода, Е-08: где рвать цепь).
    //
    // Всё остальное — включая несколько веток на одном обратном проводе —
    // значка не требует: общий провод и так нарисован общим проводом, и
    // значок ничего к этому не добавляет. Ровно на это и указал игрок,
    // спросив про Т-07, где две ветки висят на одной шине.
    const showGround = cfg.groundSymbol === undefined
      ? !!feeds
      : !!cfg.groundSymbol;
    if (showGround) {
      parts.push({ id: 'GNDS', kind: 'ground', pos: vec(gx, yBot + 14), noPads: true });
    }

    if (problems.length) for (const p of problems) console.warn('Rig | ' + (cfg.id || '?') + ': ' + p);
    return { parts, wires, problems, cols: col, rails: { xV, xG, yBot } };
  }

  // Как вид детали превращается в компонент решателя.
  function addPart(circuit, part) {
    const a = part.nets[0], b = part.nets[1], name = part.comp;
    switch (part.kind) {
      case 'resistor': case 'device': case 'pot':
        return circuit.addResistor(a, b, part.value, name);
      case 'socket': {
        // В гнезде может лежать не только резистор. Диод и светодиод —
        // детали НАПРАВЛЕННЫЕ: их сторона это топология, а не номинал, и
        // менять её можно только пересборкой цепи (уровень обязан завести
        // topologyKey). Поэтому здесь развилка, а не один addResistor.
        const c = part.content;
        // Перевёрнутая деталь добавляется в цепь задом наперёд, и её ток
        // решатель считает от nets[1] к nets[0] — знак получается обратным
        // всему остальному. Помечаем это на самой детали: и приборы, и бег
        // заряда по дорожке обязаны знать, что здесь знак другой.
        part.iSign = c && c.flipped ? -1 : 1;
        if (c && c.kind === 'diode') {
          return c.flipped ? circuit.addDiode(b, a, name) : circuit.addDiode(a, b, name);
        }
        if (c && c.kind === 'led') {
          return c.flipped ? addLed(circuit, b, a, name, c.vf || 1.8) : addLed(circuit, a, b, name, c.vf || 1.8);
        }
        return circuit.addResistor(a, b, socketOhms(part), name);
      }
      case 'jumper':
        return circuit.addResistor(a, b, 1e-3, name);
      case 'lamp': return addLamp(circuit, a, b, part.value, name);
      case 'motor': return addMotor(circuit, a, b, part.value, name);
      case 'led': return addLed(circuit, a, b, name, part.vf || 1.8);
      case 'diode':
        part.iSign = part.flipped ? -1 : 1;
        return part.flipped ? circuit.addDiode(b, a, name) : circuit.addDiode(a, b, name);
      case 'capacitor': return circuit.addCapacitor(a, b, part.value, name);
      case 'toggle': case 'button':
        return circuit.addSwitch(a, b, !!part.closed, name);
      // Обрыв дорожки рисуется по полю `repaired` (Parts.gap), а ключ живёт
      // в `closed`. Смотрим на оба: иначе запаянный игроком разрыв выглядит
      // запаянным, но ток по нему не идёт — и наоборот.
      case 'gap':
        return circuit.addSwitch(a, b, !!(part.repaired || part.closed), name);
      case 'fuse': return circuit.addSwitch(a, b, !part.blown, name);
      default: return null;
    }
  }

  function build(circuit, P) {
    const refs = {};
    for (const id of Object.keys(P)) {
      const part = P[id];
      if (part.kind === 'supply' || part.kind === 'cell' || part.kind === 'krona' || part.kind === 'feed') {
        refs[part.comp] = addSupply(circuit, part.nets[0], part.nets[1],
          part.value, part.comp, part.rInt === undefined ? SUPPLY_R.BENCH : part.rInt);
        continue;
      }
      if (!part.nets || !part.comp) continue;
      const c = addPart(circuit, part);
      if (c) refs[part.comp] = c;
    }
    return refs;
  }

  // Номиналы и ключи — только через методы цепи: прямое присваивание меняет
  // компонент, но не помечает матрицу грязной, и решатель молча продолжает
  // считать по старой факторизации.
  function apply(circuit, refs, P) {
    for (const id of Object.keys(P)) {
      const part = P[id];
      const ref = refs[part.comp];
      if (!ref) continue;
      switch (part.kind) {
        case 'resistor': case 'device': case 'pot': case 'lamp': case 'motor':
          circuit.setResistance(ref, part.value); break;
        case 'socket':
          // Диод в гнезде — не резистор: у его ссылки нет сопротивления
          // вообще, и setResistance на ней молча испортил бы матрицу.
          if (part.content && (part.content.kind === 'diode' || part.content.kind === 'led')) break;
          circuit.setResistance(ref, socketOhms(part)); break;
        case 'toggle': case 'button':
          circuit.setSwitch(ref, !!part.closed); break;
        case 'gap':
          circuit.setSwitch(ref, !!(part.repaired || part.closed)); break;
        case 'fuse':
          circuit.setSwitch(ref, !part.blown); break;
        default: break;
      }
    }
  }

  return { rows, build, apply, addPart };
})();
