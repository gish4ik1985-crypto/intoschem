'use strict';
// Уровень 2 · Освещение зоны.
// Учит одному: ток идёт только по замкнутому кругу, и разрыв в любом
// месте гасит всё. Изъяна два — обрыв дорожки и разомкнутый ключ, —
// чтобы «одно починил, а всё равно темно» произошло на своей шкуре.

const Level02 = createLevel(LevelRegistry.register({
  id: 'flashlight',
  index: 16,
  title: 'Освещение зоны',
  teaches: 'замкнутая цепь · ключ',
  silk: 'ZONE-LGT-02',
  diag: 'ДИАГНОСТИКА · Контур освещения зоны разомкнут на неизвестном участке.',
  brief: 'Лампа целая, питание есть, а света нет. Найди, где разорван круг.',
  lesson: 'Ток идёт только по целому кругу. Разрыв в любом месте — и ток встаёт во всей цепи сразу.',
  hints: [
    'Проведи взглядом от плюса батарей до минуса. Где путь прерывается?',
    'Мест, где путь прерван, два. Одно — повреждение, второе — просто выключено.',
  ],
  codex: ['circuit', 'wire', 'switch', 'lamp', 'battery'],
  water: true,
  vmax: 3.0,
  hold: 2.0,
  map: {
    pos: vec(-107, -700), radius: 900, color: hex(0xffc46b), from: ['led', 't_bus'],
    icon: { kind: 'lamp' },
  },
  goalText: 'Лампа горит и не гаснет.',
  scope: { label: 'Ток через лампу', get: (m) => m.i, min: 0, max: 0.35, band: [0.25, 0.35], fmt: fmtAmps },

  parts: [
    { id: 'BAT2', kind: 'cell', pos: vec(-240, -46), name: 'Батарейка', label: '1,5 В', silk: 'BT2', nets: ['MID', 'GND'], comp: 'V2' },
    { id: 'BAT1', kind: 'cell', pos: vec(-118, -46), name: 'Батарейка', label: '1,5 В', silk: 'BT1', nets: ['VCC', 'MID'], comp: 'V1' },
    {
      id: 'GAP', kind: 'gap', pos: vec(-6, -46), name: 'Повреждённый участок',
      silk: 'W1', nets: ['VCC', 'SW_A'], comp: 'GAPR', repaired: false,
      interact: { type: 'flag', field: 'repaired', hint: 'Нажми, чтобы запаять или снова разорвать' },
    },
    {
      id: 'SW', kind: 'toggle', pos: vec(110, -54), name: 'Ключ освещения',
      silk: 'SA1', nets: ['SW_A', 'LAMP_A'], comp: 'SW1', closed: false,
      interact: { type: 'toggle', hint: 'Нажми, чтобы щёлкнуть ключом' },
    },
    {
      id: 'LAMP', kind: 'lamp', pos: vec(222, -46), name: 'Лампа освещения',
      silk: 'HL1', nets: ['LAMP_A', 'GND'], comp: 'LAMP',
      rated: { pNom: 0.9, pMax: 2.6, tau: 0.8 },
    },
  ],

  wires: [
    { from: 'BAT2.b', to: 'BAT1.a', net: 'MID', via: 'LAMP', rated: 0.3 },
    { from: 'BAT1.b', to: 'GAP.a', net: 'VCC', via: 'LAMP', rated: 0.3 },
    { from: 'GAP.b', to: 'SW.a', net: 'SW_A', via: 'LAMP', rated: 0.3 },
    { from: 'SW.b', to: 'LAMP.a', net: 'LAMP_A', via: 'LAMP', rated: 0.3 },
    {
      pts: [vec(256, -46), vec(278, -46), vec(278, 58), vec(-292, 58), vec(-292, -46)],
      net: 'GND', via: 'LAMP', rated: 0.3,
    },
  ],

  build(c) {
    addSupply(c, 'VCC', 'MID', 1.5, 'V1', SUPPLY_R.AA_CELL);
    addSupply(c, 'MID', 'GND', 1.5, 'V2', SUPPLY_R.AA_CELL);
    const gap = c.addResistor('VCC', 'SW_A', 1e9, 'GAPR');
    const sw = c.addSwitch('SW_A', 'LAMP_A', false, 'SW1');
    const lamp = addLamp(c, 'LAMP_A', 'GND', 10.0, 'LAMP');
    return { GAPR: gap, SW1: sw, LAMP: lamp };
  },

  apply(refs, P, c) {
    c.setResistance(refs.GAPR, P.GAP.repaired ? 1e-3 : 1e9);
    c.setSwitch(refs.SW1, P.SW.closed);
  },

  read(sol, refs, P) {
    return {
      i: sol.componentCurrent['LAMP'] || 0,
      uLamp: sol.nodeVoltage['LAMP_A'] || 0,
      repaired: P.GAP.repaired,
      closed: P.SW.closed,
    };
  },

  status(m) {
    if (!m.repaired && !m.closed) return ['Темно. Цепь разорвана сразу в двух местах.', 'neutral'];
    if (!m.repaired) return ['Ключ замкнут, но толку нет: дальше по цепи обрыв дорожки.', 'warn'];
    if (!m.closed) return ['Дорожка цела, но ключ разомкнут — круг всё ещё не замкнут.', 'warn'];
    return ['Круг замкнут: ток идёт, лампа горит.', 'good'];
  },

  goal(m) {
    return {
      ok: m.i > 0.25,
      note: m.i > 0.001 ? 'Ток через лампу ' + fmtAmps(m.i) : 'Тока нет совсем.',
    };
  },

  score(m) { return clamp(m.i / 0.3, 0, 1); },
  scoreNote(m) { return 'Ток ' + fmtAmps(m.i) + ' · на лампе ' + fmtVolts(m.uLamp); },

  meter(m, P) {
    return [
      ['Ток через лампу', fmtAmps(m.i), m.i > 0.25 ? 'good' : ''],
      ['Напряжение на лампе', fmtVolts(m.uLamp)],
      ['Мощность лампы', fmtWatts(P.LAMP.p)],
      ['Дорожка', m.repaired ? 'цела' : 'обрыв', m.repaired ? 'good' : 'bad'],
      ['Ключ', m.closed ? 'замкнут' : 'разомкнут', m.closed ? 'good' : 'warn'],
    ];
  },
}));
