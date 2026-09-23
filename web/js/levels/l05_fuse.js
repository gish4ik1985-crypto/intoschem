'use strict';
// Уровень 5 · Защита.
// Короткое замыкание и предохранитель. Задача не в том, чтобы поставить
// предохранитель побольше, а в том, чтобы НАЙТИ виноватую ветку —
// отключая их по одной и глядя на ток.

const FUSE_KIT = [0.05, 0.1, 0.2, 0.5];

const Level05 = createLevel(LevelRegistry.register({
  id: 'fuse_box',
  index: 19,
  title: 'Защита',
  teaches: 'короткое замыкание · предохранитель',
  silk: 'PRT-BUS-05',
  diag: 'ДИАГНОСТИКА · Предохранитель шины выгорает мгновенно после подачи питания.',
  brief: 'Предохранитель сгорает сразу. Одна из трёх веток замкнута — найди какую.',
  lesson: 'Короткое замыкание — путь для тока без помехи, и ток вырастает в сотни раз. Предохранитель сгорает, чтобы спасти остальное.',
  hints: [
    'Отключи все три ветки и поставь целый предохранитель. Потом включай по одной.',
    'Ветка, от которой ток подскакивает в сотню раз, и есть замкнутая.',
    'Две исправные ветки берут около 110 мА вместе. Предохранитель нужен чуть выше этого, а не «побольше на всякий случай».',
  ],
  codex: ['short', 'fuse', 'power', 'series'],
  vmax: 12.0,
  hold: 3.0,
  scale: 1.22,
  board: { x: -310, y: -140, w: 620, h: 292 },
  map: { pos: vec(323, -535), radius: 900, color: hex(0xff8a4a), from: ['garland', 'panel'], icon: { kind: 'fuse' } },
  goalText: 'Две целые ветки работают, предохранитель цел.',
  scope: { label: 'Ток через предохранитель', get: (m) => m.total, min: 0, max: 0.3, band: [0.09, 0.13], fmt: fmtAmps },

  parts: [
    { id: 'SUP', kind: 'supply', pos: vec(-230, -40), name: 'Питание шины', label: '12 В', silk: 'G1', nets: ['VCC', 'GND'], comp: 'V1' },
    {
      id: 'FUSE', kind: 'fuse', pos: vec(-100, -100), name: 'Предохранитель',
      silk: 'FU1', nets: ['VCC', 'BUS'], comp: 'FUSE', value: 0.2, blown: false,
      showValue: true, valueText: (p) => (p.blown ? 'сгорел' : fmtFuse(p.value)),
      interact: {
        type: 'pick', title: 'Поставить предохранитель', hint: 'Нажми, чтобы заменить или сменить номинал',
        options: () => FUSE_KIT.map((a) => ({ label: fmtFuse(a), value: a, blown: false })),
      },
    },
    branchSwitch('SWA', -52), branchLoad('LDA', -52, false, 'ветка A'),
    branchSwitch('SWB', 14), branchLoad('LDB', 14, false, 'ветка B'),
    branchSwitch('SWC', 80), branchLoad('LDC', 80, false, 'ветка C'),
  ],

  wires: [
    { pts: [vec(-166, -58), vec(-166, -100), vec(-144, -100)], net: 'VCC', via: 'FUSE', rated: 0.25 },
    { pts: [vec(-56, -100), vec(-20, -100), vec(-20, 80)], net: 'BUS', via: 'FUSE', rated: 0.25 },
    // y=116, а не 126: 126 проходило прямо по шелкографии «PRT-BUS-05».
    { pts: [vec(250, -52), vec(250, 116), vec(-166, 116), vec(-166, -22)], net: 'GND', via: 'FUSE', rated: 0.25 },
    ...branchWires(-52, 'A'), ...branchWires(14, 'B'), ...branchWires(80, 'C'),
  ],

  // Нить предохранителя калится по тому, насколько близко ток к номиналу:
  // видно, что «пока держится, но на пределе».
  partView(part, m) {
    if (part.id !== 'FUSE') return null;
    return { heat: clamp(m.total / part.value, 0, 1), burnt: part.blown };
  },

  build(c) {
    addSupply(c, 'VCC', 'GND', 12.0, 'V1', SUPPLY_R.BENCH);
    const fuse = c.addSwitch('VCC', 'BUS', true, 'FUSE');
    const swa = c.addSwitch('BUS', 'A1', false, 'SWA');
    const swb = c.addSwitch('BUS', 'B1', false, 'SWB');
    const swc = c.addSwitch('BUS', 'C1', false, 'SWC');
    const la = c.addResistor('A1', 'GND', 220, 'LDA');
    const lb = c.addResistor('B1', 'GND', 220, 'LDB');
    // Повреждённый прибор замкнул шину: сопротивление почти нулевое —
    // это и есть короткое замыкание, а не «сломанная лампочка».
    const lc = c.addResistor('C1', 'GND', 0.6, 'LDC');
    return { FUSE: fuse, SWA: swa, SWB: swb, SWC: swc, LDA: la, LDB: lb, LDC: lc };
  },

  apply(refs, P, c) {
    c.setSwitch(refs.FUSE, !P.FUSE.blown);
    c.setSwitch(refs.SWA, P.SWA.closed);
    c.setSwitch(refs.SWB, P.SWB.closed);
    c.setSwitch(refs.SWC, P.SWC.closed);
  },

  // Плавкая вставка — механика вне матрицы: смотрим ток и решаем, цела
  // ли она ещё. Гистерезиса тут нет: сгорела — значит сгорела.
  tick(dt, P, m, refs, c, api) {
    if (!P.FUSE.blown && Math.abs(m.total) > P.FUSE.value) {
      P.FUSE.blown = true;
      api.flash('Предохранитель сгорел', 'bad');
    }
  },

  read(sol, refs, P) {
    return {
      total: Math.abs(sol.componentCurrent['FUSE'] || 0),
      ia: Math.abs(sol.componentCurrent['LDA'] || 0),
      ib: Math.abs(sol.componentCurrent['LDB'] || 0),
      ic: Math.abs(sol.componentCurrent['LDC'] || 0),
      blown: P.FUSE.blown,
      rating: P.FUSE.value,
    };
  },

  status(m, P) {
    if (m.blown) return ['Предохранитель сгорел. Замени его и разбирайся дальше отключением веток.', 'bad'];
    if (P.SWC.closed) return ['Пока держится, но ветка C ещё подключена — рано или поздно рванёт.', 'warn'];
    if (!P.SWA.closed && !P.SWB.closed) return ['Всё отключено. Предохранитель цел, но и толку никакого.', 'neutral'];
    if (!P.SWA.closed || !P.SWB.closed) return ['Одна исправная ветка ещё отключена.', 'warn'];
    return ['Замыкание отключено, обе исправные ветки работают, предохранитель держит.', 'good'];
  },

  goal(m, P) {
    if (m.blown) return { ok: false, note: 'Предохранитель сгорел.' };
    const ok = P.SWA.closed && P.SWB.closed && !P.SWC.closed;
    return { ok, note: ok ? 'Ток шины ' + fmtAmps(m.total) : 'Нужны обе исправные ветки и ни одной замкнутой.' };
  },

  score(m, P) {
    if (m.blown || !P.SWA.closed || !P.SWB.closed || P.SWC.closed) return 0;
    // Предохранитель с запасом в пять раз формально работает, но защищает
    // хуже: ставим за это меньше.
    return m.rating <= 0.2 ? 1.0 : 0.7;
  },
  scoreNote(m) {
    return 'Рабочий ток ' + fmtAmps(m.total) + ' · предохранитель ' + fmtFuse(m.rating)
      + (m.rating > 0.2 ? ' — запас великоват' : ' — в самый раз');
  },

  meter(m) {
    return [
      ['Ток шины', fmtAmps(m.total), m.total > 0.5 ? 'bad' : (m.total > 0.001 ? 'good' : '')],
      ['Ветка A', fmtAmps(m.ia)],
      ['Ветка B', fmtAmps(m.ib)],
      ['Ветка C', fmtAmps(m.ic), m.ic > 0.5 ? 'bad' : ''],
      ['Предохранитель', m.blown ? 'сгорел' : fmtFuse(m.rating), m.blown ? 'bad' : 'good'],
    ];
  },
}));

function fmtFuse(a) { return a >= 1 ? trimNum(a) + ' А' : Math.round(a * 1000) + ' мА'; }

function branchSwitch(id, y) {
  return {
    id, kind: 'toggle', pos: vec(40, y - 8), name: 'Ключ ветки', silk: id,
    nets: ['BUS', id.slice(2) + '1'], comp: id, closed: false,
    interact: { type: 'toggle', hint: 'Нажми, чтобы подключить или отключить ветку' },
  };
}

function branchLoad(id, y, damaged, label) {
  return {
    id, kind: 'device', pos: vec(170, y), name: label, silk: id, label,
    nets: [id.slice(2) + '1', 'GND'], comp: id, damaged,
    rated: { pMax: 400, tau: 0.6 },
  };
}

function branchWires(y, letter) {
  return [
    { pts: [vec(-20, y), vec(2, y)], net: 'BUS', via: 'SW' + letter, rated: 0.25 },
    { pts: [vec(78, y), vec(124, y)], net: letter + '1', via: 'SW' + letter, rated: 0.25 },
    { pts: [vec(216, y), vec(250, y)], net: 'GND', via: 'LD' + letter, rated: 0.25 },
  ];
}
