'use strict';
// Уровень 14 · Развилка токов.
// Итоговый: три ветки на одной шине. Токи веток складываются в общий, а
// каждая ветка живёт своей жизнью. Надо попасть тремя номиналами сразу и
// при этом не выйти за предохранитель.

const Level14 = createLevel(LevelRegistry.register({
  id: 'fork',
  index: 28,
  title: 'Развилка токов',
  teaches: 'ток в узле',
  silk: 'FRK-BUS-14',
  diag: 'ДИАГНОСТИКА · Развилка шины разобрана, три потребителя обесточены.',
  brief: 'Три потребителя на одной шине, каждому нужен свой ток. Все три гнезда пустые, а общий предохранитель держит только 250 мА.',
  lesson: 'В узле ток не теряется и не появляется: сколько втекло по шине, столько и разошлось по веткам. Каждая ветка при этом считается отдельно — напряжение на всех одинаковое, а ток задаёт только её собственное сопротивление. Общий ток — это просто их сумма, и именно за ней следит предохранитель.',
  hints: [
    'Каждая ветка видит одни и те же двенадцать вольт. Считай её отдельно от остальных.',
    'Двенадцать вольт разделить на нужный ток — получится номинал для этой ветки.',
    'Сложи три получившихся тока и сравни с предохранителем: 120 плюс 55 плюс 26 — это чуть больше двухсот.',
  ],
  codex: ['series', 'ohm', 'fuse', 'divider'],
  vmax: 12.0,
  hold: 3.0,
  scale: 1.28,
  board: { x: -310, y: -140, w: 620, h: 272 },
  map: { pos: vec(-1397, -300), radius: 900, color: hex(0xc0ffa0), from: 'sensor', icon: { kind: 'resistor', value: 100 } },
  goalText: 'Ветки: 120 мА, 55 мА и 26 мА. Общий ток — под предохранителем.',
  scope: { label: 'Общий ток шины', get: (m) => m.total, min: 0, max: 0.35, band: [0.18, 0.22], fmt: fmtAmps },

  parts: [
    { id: 'SUP', kind: 'supply', pos: vec(-230, -40), name: 'Питание шины', label: '12 В', silk: 'G1', nets: ['VCC', 'GND'], comp: 'V1' },
    {
      id: 'FUSE', kind: 'fuse', pos: vec(-100, -100), name: 'Предохранитель 250 мА', silk: 'FU1',
      nets: ['VCC', 'BUS'], comp: 'FUSE', value: 0.25, blown: false,
      showValue: true, valueText: (p) => (p.blown ? 'сгорел' : '250 мА'),
      interact: { type: 'pick', title: 'Предохранитель', hint: 'Нажми, чтобы заменить сгоревший', options: () => [{ label: 'поставить новый', note: '250 мА', value: 0.25, blown: false }] },
    },
    forkSocket('FA', -40, 'Ветка A · нужно 120 мА'),
    forkSocket('FB', 10, 'Ветка B · нужно 55 мА'),
    forkSocket('FC', 60, 'Ветка C · нужно 26 мА'),
  ],

  wires: [
    { pts: [vec(-166, -58), vec(-166, -100), vec(-144, -100)], net: 'VCC', via: 'FUSE', rated: 0.25 },
    { pts: [vec(-56, -100), vec(-20, -100), vec(-20, 60)], net: 'BUS', via: 'FUSE', rated: 0.25 },
    // y=94, а не 110: 110 проходило прямо по шелкографии «FRK-BUS-14».
    { pts: [vec(250, -40), vec(250, 94), vec(-166, 94), vec(-166, -22)], net: 'GND', via: 'FUSE', rated: 0.25 },
    ...forkWires(-40, 'A'), ...forkWires(10, 'B'), ...forkWires(60, 'C'),
  ],

  build(c) {
    addSupply(c, 'VCC', 'GND', 12.0, 'V1', SUPPLY_R.BENCH);
    const fuse = c.addSwitch('VCC', 'BUS', true, 'FUSE');
    return {
      FUSE: fuse,
      FA: c.addResistor('BUS', 'GND', 1e9, 'FA'),
      FB: c.addResistor('BUS', 'GND', 1e9, 'FB'),
      FC: c.addResistor('BUS', 'GND', 1e9, 'FC'),
    };
  },

  apply(refs, P, c) {
    c.setSwitch(refs.FUSE, !P.FUSE.blown);
    for (const id of ['FA', 'FB', 'FC']) c.setResistance(refs[id], P[id].burnt ? 1e9 : socketOhms(P[id]));
  },

  tick(dt, P, m, refs, c, api) {
    if (!P.FUSE.blown && Math.abs(m.total) > P.FUSE.value) {
      P.FUSE.blown = true;
      api.flash('Предохранитель сгорел: суммарный ток превысил ' + fmtFuse(P.FUSE.value), 'bad');
    }
  },

  partView(part, m) {
    if (part.id !== 'FUSE') return null;
    return { heat: clamp(m.total / part.value, 0, 1), burnt: part.blown };
  },

  read(sol, refs, P) {
    const ia = Math.abs(sol.componentCurrent['FA'] || 0);
    const ib = Math.abs(sol.componentCurrent['FB'] || 0);
    const ic = Math.abs(sol.componentCurrent['FC'] || 0);
    return { ia, ib, ic, total: ia + ib + ic, blown: P.FUSE.blown };
  },

  status(m) {
    if (m.blown) return ['Предохранитель сгорел: сумма токов веток превысила его номинал.', 'bad'];
    const okA = inBand(m.ia, 0.12), okB = inBand(m.ib, 0.055), okC = inBand(m.ic, 0.026);
    const n = [okA, okB, okC].filter(Boolean).length;
    if (n === 3) return ['Все три ветки в норме, и общий ток укладывается в предохранитель.', 'good'];
    if (n === 0) return ['Ни одна ветка пока не настроена. Считай каждую отдельно от остальных.', 'neutral'];
    return ['Настроено веток: ' + n + ' из 3.', 'warn'];
  },

  goal(m) {
    const ok = !m.blown && inBand(m.ia, 0.12) && inBand(m.ib, 0.055) && inBand(m.ic, 0.026);
    return { ok, note: 'A ' + fmtAmps(m.ia) + ' · B ' + fmtAmps(m.ib) + ' · C ' + fmtAmps(m.ic) };
  },

  score(m) {
    if (m.blown) return 0;
    const n = [inBand(m.ia, 0.12), inBand(m.ib, 0.055), inBand(m.ic, 0.026)].filter(Boolean).length;
    return n / 3;
  },
  scoreNote(m) { return 'Сумма токов веток ' + fmtAmps(m.total) + ' — ровно то, что идёт через предохранитель'; },

  meter(m) {
    return [
      ['Ветка A → 120 мА', fmtAmps(m.ia), inBand(m.ia, 0.12) ? 'good' : 'warn'],
      ['Ветка B → 55 мА', fmtAmps(m.ib), inBand(m.ib, 0.055) ? 'good' : 'warn'],
      ['Ветка C → 26 мА', fmtAmps(m.ic), inBand(m.ic, 0.026) ? 'good' : 'warn'],
      ['Сумма', fmtAmps(m.total), m.total > 0.25 ? 'bad' : ''],
      ['Предохранитель', m.blown ? 'сгорел' : '250 мА', m.blown ? 'bad' : 'good'],
    ];
  },
}));

function inBand(value, target) { return Math.abs(value - target) <= target * 0.12; }

function forkSocket(id, y, name) {
  return {
    id, kind: 'socket', pos: vec(120, y), name, silk: id,
    nets: ['BUS', 'GND'], comp: id, showValue: true, valueText: socketLabel,
    content: null, rated: { pMax: 2.5, tau: 1.0 },
    interact: { type: 'pick', title: name, hint: 'Нажми, чтобы подобрать номинал', options: () => socketOptions({ jumper: false }) },
  };
}

function forkWires(y, letter) {
  return [
    { pts: [vec(-20, y), vec(76, y)], net: 'BUS', via: 'F' + letter, rated: 0.13 },
    { pts: [vec(164, y), vec(250, y)], net: 'GND', via: 'F' + letter, rated: 0.13 },
  ];
}
