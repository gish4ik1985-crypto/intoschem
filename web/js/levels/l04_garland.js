'use strict';
// Уровень 4 · Ёлочная гирлянда.
// Последовательное против параллельного — на примере, где разница видна
// сразу: одна перегоревшая лампа в цепочке гасит все остальные.
// Лампы здесь рассчитаны на полные 12 В (так устроены современные
// гирлянды), поэтому в цепочке по пять они еле тлеют, а на шине горят
// как положено.

const Level04 = createLevel(LevelRegistry.register({
  id: 'garland',
  index: 18,
  title: 'Ёлочная гирлянда',
  teaches: 'последовательно и параллельно',
  silk: 'GRL-05-04',
  diag: 'ДИАГНОСТИКА · Гирлянда обесточена целиком из-за одного звена.',
  brief: 'Одна лампа перегорела — и погасли все пять. Сделай так, чтобы гасла только она.',
  lesson: 'Лампы цепочкой делят один ток на всех: сгорела одна — погасли все. Лампы рядом, каждая на своих проводах, горят сами по себе.',
  hints: [
    'Нажми на любую лампу — можно выбрать, как она подключена.',
    'Пока хоть одна рабочая лампа стоит в цепочке с перегоревшей, ток через эту цепочку не пойдёт.',
    'Каждой лампе нужна вся сила батареи, а не пятая часть.',
  ],
  codex: ['series', 'lamp', 'circuit'],
  vmax: 12.0,
  hold: 2.5,
  scale: 1.3,
  board: { x: -310, y: -130, w: 620, h: 262 },
  map: { pos: vec(323, -700), radius: 900, color: hex(0x8fd88f), from: ['panel', 't_check'], icon: { kind: 'lamp' } },
  goalText: 'Четыре целые лампы горят ярко.',
  scope: { label: 'Ток от источника', get: (m) => m.total, min: 0, max: 2.0, band: [1.4, 1.75], fmt: fmtAmps },

  parts: [
    { id: 'SUP', kind: 'supply', pos: vec(-232, -66), name: 'Питание гирлянды', label: '12 В', silk: 'G1', nets: ['VCC', 'GND'], comp: 'V1' },
    // Ряд сдвинут на +26 относительно исходного: при -150 корпус L1
    // (68×52) накладывался на блок питания SUP (128×78) на 16×17 px.
    lampSpec('L1', -124, false),
    lampSpec('L2', -49, false),
    lampSpec('L3', 26, true),
    lampSpec('L4', 101, false),
    lampSpec('L5', 176, false),
  ],

  // Провода зависят от того, как игрок развёл гирлянду, — иначе картинка
  // врала бы про схему.
  wires(P) {
    const list = [];
    const busY = -96, gndY = 62;

    // Докуда тянуть шины — считаем от того, что к ним сейчас реально
    // подключено, а не жёстким числом. Раньше обе шли до x=250 всегда, и
    // в «цепочке» верхняя шина тянулась через всю плату при единственном
    // отводе на x=-158: справа торчали два рельса в пустоту. Ошибка не
    // видна ни в логе, ни решателю — топология от длины шины не зависит.
    const series = LAMP_IDS.filter((id) => P[id].wiring === 'series');
    const parallel = LAMP_IDS.filter((id) => P[id].wiring === 'parallel');
    const vccTaps = [], gndTaps = [];
    if (series.length) {
      vccTaps.push(P[series[0]].pos.x - 34);
      gndTaps.push(P[series[series.length - 1]].pos.x + 34);
    }
    for (const id of parallel) {
      vccTaps.push(P[id].pos.x - 34);
      gndTaps.push(P[id].pos.x + 34);
    }
    // Ни одна лампа не подключена — шину рисовать не от чего и незачем:
    // остаётся только вывод самого блока питания.
    const railEnd = (taps) => (taps.length ? Math.max.apply(null, taps) : -168);
    const vccEnd = railEnd(vccTaps), gndEnd = railEnd(gndTaps);
    list.push({ pts: [vec(-168, -84), vec(-168, busY), vec(vccEnd, busY)], net: 'VCC', via: 'V1', rated: 1.8 });
    list.push({ pts: [vec(-168, -48), vec(-168, gndY), vec(gndEnd, gndY)], net: 'GND', via: 'V1', rated: 1.8 });

    // Цепочка: с шины в первую лампу, дальше от лампы к лампе, из
    // последней — на землю.
    //
    // Между двумя соседними ЗВЕНЬЯМИ цепочки в ряду может физически стоять
    // лампа, подключённая на шину, — ряд один на всех пятерых, и порядок
    // в нём не совпадает с порядком в цепочке. Прямая линия на высоте
    // ряда тогда идёт сквозь корпус этой пропущенной лампы. DETOUR_Y —
    // высота чуть ниже ряда (габарит лампы 68×52, нижний край на +26 от
    // её центра), где корпусов уже нет ни у кого.
    const DETOUR_Y = -18 + 34;
    series.forEach((id, k) => {
      const part = P[id];
      const inNet = k === 0 ? 'VCC' : 'CH' + k;
      let start;
      if (k === 0) {
        start = [vec(part.pos.x - 34, busY), vec(part.pos.x - 34, part.pos.y)];
      } else {
        const prev = P[series[k - 1]];
        const between = LAMP_IDS.some((lid) => P[lid].pos.x > prev.pos.x && P[lid].pos.x < part.pos.x);
        start = between
          ? [vec(prev.pos.x + 34, prev.pos.y), vec(prev.pos.x + 34, DETOUR_Y), vec(part.pos.x - 34, DETOUR_Y), vec(part.pos.x - 34, part.pos.y)]
          : [vec(prev.pos.x + 34, part.pos.y), vec(part.pos.x - 34, part.pos.y)];
      }
      list.push({ pts: start, net: inNet, via: series[0], rated: 0.5 });
      if (k === series.length - 1) {
        list.push({
          pts: [vec(part.pos.x + 34, part.pos.y), vec(part.pos.x + 34, gndY)],
          net: 'GND', via: series[0], rated: 0.5,
        });
      }
    });

    for (const id of LAMP_IDS) {
      const part = P[id];
      if (part.wiring !== 'parallel') continue;
      list.push({ pts: [vec(part.pos.x - 34, busY), vec(part.pos.x - 34, part.pos.y)], net: 'VCC', via: id, rated: 0.45 });
      list.push({ pts: [vec(part.pos.x + 34, part.pos.y), vec(part.pos.x + 34, gndY)], net: 'GND', via: id, rated: 0.45 });
    }
    return list;
  },

  topologyKey(P) { return LAMP_IDS.map((id) => P[id].wiring).join(''); },

  build(c, P) {
    addSupply(c, 'VCC', 'GND', 12.0, 'V1', SUPPLY_R.BENCH);
    const refs = {};
    const series = LAMP_IDS.filter((id) => P[id].wiring === 'series');
    series.forEach((id, k) => {
      const inNode = k === 0 ? 'VCC' : 'CH' + k;
      const outNode = k === series.length - 1 ? 'GND' : 'CH' + (k + 1);
      refs[id] = c.addResistor(inNode, outNode, 30.0, id);
      P[id].nets = [inNode, outNode];
    });
    for (const id of LAMP_IDS) {
      if (P[id].wiring === 'series') continue;
      refs[id] = c.addResistor('VCC', 'GND', 30.0, id);
      P[id].nets = ['VCC', 'GND'];
    }
    return refs;
  },

  apply(refs, P, c) {
    for (const id of LAMP_IDS) {
      if (!refs[id]) continue;
      c.setResistance(refs[id], P[id].burnt ? 1e9 : 30.0);
    }
  },

  read(sol, refs, P) {
    const alive = LAMP_IDS.filter((id) => !P[id].burnt);
    const bright = alive.map((id) => P[id].bright || 0);
    return {
      total: Math.abs(sol.componentCurrent['V1'] || 0),
      litCount: bright.filter((b) => b > 0.75).length,
      minBright: bright.length ? Math.min.apply(null, bright) : 0,
      inSeries: LAMP_IDS.filter((id) => P[id].wiring === 'series').length,
    };
  },

  status(m) {
    if (m.litCount === 4) return ['Все четыре целые лампы горят ровно. Перегоревшая гаснет одна и никому не мешает.', 'good'];
    if (m.litCount === 0 && m.inSeries > 0) return ['Гирлянда мертва: в цепочке стоит перегоревшая лампа, и ток не идёт вообще.', 'bad'];
    if (m.inSeries > 0) return ['Часть ламп ещё в цепочке: пока перегоревшая стоит с ними в одном ряду, они не загорятся.', 'warn'];
    return ['Посмотри, какие лампы стоят цепочкой, а какие — каждая на своих проводах.', 'neutral'];
  },

  goal(m) {
    return { ok: m.litCount === 4, note: 'Горит в полную силу ламп: ' + m.litCount + ' из 4.' };
  },

  score(m) { return clamp(m.litCount / 4, 0, 1); },
  scoreNote(m) { return 'Общий ток гирлянды ' + fmtAmps(m.total); },

  meter(m, P) {
    return [
      ['Горит ламп', m.litCount + ' из 4', m.litCount === 4 ? 'good' : 'warn'],
      ['Ток от источника', fmtAmps(m.total)],
      ['В цепочке', String(m.inSeries)],
      ['На шине', String(5 - m.inSeries)],
      ['На лампе L1', fmtVolts(P.L1.u)],
    ];
  },
}));

const LAMP_IDS = ['L1', 'L2', 'L3', 'L4', 'L5'];

// Лампы отличаются только положением и тем, что третья найдена
// перегоревшей — запасной для неё нет, и в этом весь смысл уровня.
function lampSpec(id, x, dead) {
  return {
    id, kind: 'lamp', pos: vec(x, -18),
    name: dead ? 'Лампа (перегорела)' : 'Лампа гирлянды',
    silk: id, comp: id, wiring: 'series',
    showValue: true,
    valueText: (part) => (part.burnt ? 'перегорела' : (part.wiring === 'series' ? 'в цепочке' : 'на шине')),
    burnt: dead, noReplace: dead,
    rated: { pNom: 4.8, pMax: 7.0, tau: 0.9 },
    interact: {
      type: 'cycle', field: 'wiring', values: ['series', 'parallel'],
      hint: 'Нажми: в цепочку или на свои провода',
    },
  };
}
