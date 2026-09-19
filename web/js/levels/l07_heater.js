'use strict';
// Уровень 7 · Подогрев стекла.
// Нужного сопротивления в ящике нет вообще. Два резистора рядом дают
// меньше, чем любой из них по отдельности, — и это единственный способ
// получить требуемое, не спалив ничего по дороге.

const Level07 = createLevel(LevelRegistry.register({
  id: 'heater',
  index: 21,
  title: 'Подогрев стекла',
  teaches: 'параллельное соединение',
  silk: 'HTR-GLS-07',
  diag: 'ДИАГНОСТИКА · Обогрев стекла не выходит на расчётную мощность.',
  brief: 'Стекло камеры запотевает: обогрев не выдаёт нужную мощность. Нужно 160 мА от двенадцати вольт — то есть ровно 75 Ом. Такого номинала в ящике нет.',
  lesson: 'Два резистора, поставленные рядом, дают сопротивление меньше меньшего из них: ток находит себе два пути вместо одного. Два по 150 Ом вместе работают как 75. Заодно и греется каждый вдвое меньше — один резистор на всю мощность просто сгорел бы.',
  hints: [
    'Одного резистора здесь не хватит: подходящий по току слишком мал по мощности и сгорит.',
    'Рядом стоящие резисторы делят ток между собой. Два одинаковых дают половину сопротивления.',
    'Нужно 75 Ом. Возьми два по 150.',
  ],
  codex: ['series', 'ohm', 'power', 'resistor'],
  vmax: 12.0,
  hold: 3.0,
  scale: 1.3,
  board: { x: -300, y: -132, w: 600, h: 264 },
  map: { pos: vec(-107, -535), radius: 900, color: hex(0xff9a5c), from: ['flashlight', 'divider'], icon: { kind: 'resistor', value: 150 } },
  goalText: 'Общий ток обогрева 150–172 мА, и ни один элемент не перегрет.',
  scope: { label: 'Общий ток обогрева', get: (m) => m.total, min: 0, max: 0.3, band: [0.15, 0.172], fmt: fmtAmps },

  parts: [
    { id: 'SUP', kind: 'supply', pos: vec(-230, -20), name: 'Питание обогрева', label: '12 В', silk: 'G1', nets: ['VCC', 'GND'], comp: 'V1' },
    heaterSocket('H1', -80, 'Нагревательный элемент 1'),
    heaterSocket('H2', 30, 'Нагревательный элемент 2'),
  ],

  wires: [
    { pts: [vec(-166, -38), vec(-166, -80), vec(16, -80)], net: 'VCC', via: 'H1', rated: 0.1 },
    { pts: [vec(-40, -80), vec(-40, 30), vec(16, 30)], net: 'VCC', via: 'H2', rated: 0.1 },
    { pts: [vec(104, -80), vec(200, -80), vec(200, 30)], net: 'GND', via: 'H1', rated: 0.1 },
    { pts: [vec(104, 30), vec(200, 30)], net: 'GND', via: 'H2', rated: 0.1 },
    // dir: -1 — обратная дорожка нарисована от нагрузки к минусу источника.
    { pts: [vec(200, 30), vec(200, 90), vec(-166, 90), vec(-166, -2)], net: 'GND', via: 'V1', dir: -1, rated: 0.2 },
  ],

  build(c) {
    addSupply(c, 'VCC', 'GND', 12.0, 'V1', SUPPLY_R.BENCH);
    return {
      H1: c.addResistor('VCC', 'GND', 1e9, 'H1'),
      H2: c.addResistor('VCC', 'GND', 1e9, 'H2'),
    };
  },

  apply(refs, P, c) {
    c.setResistance(refs.H1, P.H1.burnt ? 1e9 : socketOhms(P.H1));
    c.setResistance(refs.H2, P.H2.burnt ? 1e9 : socketOhms(P.H2));
  },

  read(sol, refs, P) {
    const i1 = Math.abs(sol.componentCurrent['H1'] || 0);
    const i2 = Math.abs(sol.componentCurrent['H2'] || 0);
    return {
      i1, i2, total: i1 + i2,
      p1: P.H1.p, p2: P.H2.p,
      burnt: P.H1.burnt || P.H2.burnt,
      rTotal: (i1 + i2) > 1e-9 ? 12 / (i1 + i2) : Infinity,
    };
  },

  status(m) {
    if (m.burnt) return ['Элемент сгорел: на одном резисторе оказалась вся мощность сразу.', 'bad'];
    if (m.total < 0.001) return ['Обогрева нет вообще — оба гнезда пустые.', 'neutral'];
    if (m.total > 0.172) return ['Тока больше нормы: суммарное сопротивление слишком маленькое.', 'warn'];
    if (m.total < 0.15) return ['Тока не хватает: суммарное сопротивление великовато.', 'warn'];
    return ['Ровно 75 Ом на двоих. Обогрев вышел на режим, и никто не перегрет.', 'good'];
  },

  goal(m) {
    if (m.burnt) return { ok: false, note: 'Сгоревший элемент — замени и попробуй иначе.' };
    return {
      ok: m.total >= 0.15 && m.total <= 0.172,
      note: 'Ток ' + fmtAmps(m.total) + ' · это ' + (isFinite(m.rTotal) ? fmtOhms(m.rTotal) : '∞') + ' на двоих',
    };
  },

  score(m) { return m.burnt ? 0 : clamp(1 - Math.abs(m.total - 0.16) / 0.06, 0, 1); },
  scoreNote(m) { return 'Каждый элемент рассеивает ' + fmtWatts(m.p1) + ' и ' + fmtWatts(m.p2); },

  meter(m, P) {
    return [
      ['Общий ток', fmtAmps(m.total), m.total >= 0.15 && m.total <= 0.172 ? 'good' : 'warn'],
      ['Сопротивление', isFinite(m.rTotal) ? fmtOhms(m.rTotal) : '∞'],
      ['Через элемент 1', fmtAmps(m.i1)],
      ['Через элемент 2', fmtAmps(m.i2)],
      ['Нагрев элементов', Math.round(Math.max(P.H1.heat, P.H2.heat) * 100) + '%',
        Math.max(P.H1.heat, P.H2.heat) > 0.8 ? 'bad' : ''],
    ];
  },
}));

function heaterSocket(id, y, name) {
  return {
    id, kind: 'socket', pos: vec(60, y), name, silk: id,
    nets: ['VCC', 'GND'], comp: id, showValue: true, valueText: socketLabel,
    content: null,
    rated: { pMax: 1.5, tau: 0.9 },
    interact: { type: 'pick', title: 'Нагревательный элемент', hint: 'Нажми, чтобы выбрать номинал', options: () => socketOptions({ jumper: false }) },
  };
}
