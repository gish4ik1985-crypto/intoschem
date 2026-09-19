'use strict';
// Уровень 3 · Подсветка панели.
// Первый уровень, где мало «загорелось» — надо попасть в диапазон.
// Здесь появляется закон Ома как рабочий инструмент, а не как формула.

const Level03 = createLevel(LevelRegistry.register({
  id: 'panel',
  index: 17,
  title: 'Подсветка панели',
  teaches: 'закон Ома · номинал',
  silk: 'PNL-DIM-03',
  diag: 'ДИАГНОСТИКА · Дежурная подсветка выведена за пределы номинала.',
  brief: 'Дежурная подсветка должна светить вполсилы — не ярче и не тусклее. Сейчас в гнезде стоит не тот резистор, и лампа слепит.',
  lesson: 'Резистор и лампа делят между собой девять вольт источника, и ток у них общий. Чем больше сопротивление в гнезде, тем меньше достаётся лампе. Нужного номинала может не быть точно — попадают в допуск, а не в точку.',
  hints: [
    'Наведи курсор на лампу и на резистор: увидишь, сколько вольт достаётся каждому.',
    'Ток нужен около 145 мА. Всего девять вольт, лампа сама по себе 30 Ом.',
    'Девять вольт разделить на 0,145 ампера — это полное сопротивление цепи, около 62 Ом. Тридцать из них уже занимает лампа.',
  ],
  codex: ['ohm', 'resistor', 'lamp', 'power'],
  vmax: 9.0,
  hold: 2.5,
  map: { pos: vec(108, -700), radius: 900, color: hex(0x8fd8ff), from: ['flashlight', 't_check'], icon: { kind: 'lamp' } },
  goalText: 'Дежурный режим: ток через лампу 130–160 мА.',
  scope: { label: 'Ток через лампу', get: (m) => m.i, min: 0, max: 0.32, band: [0.13, 0.16], fmt: fmtAmps },

  parts: [
    { id: 'BAT', kind: 'krona', pos: vec(-238, 6), name: 'Крона 9 В', label: '9 В', silk: 'BT1', nets: ['VCC', 'GND'], comp: 'V1' },
    {
      id: 'SLOT', kind: 'socket', pos: vec(-60, -48), name: 'Гасящий резистор',
      silk: 'R1', nets: ['VCC', 'LAMP_A'], comp: 'R1', showValue: true, valueText: socketLabel,
      content: { kind: 'resistor', value: 10 },
      rated: { pMax: 1.6, tau: 1.0 },
      interact: { type: 'pick', title: 'Резистор в гнездо', hint: 'Нажми, чтобы подобрать номинал', options: () => socketOptions({ empty: true, jumper: true }) },
    },
    {
      id: 'LAMP', kind: 'lamp', pos: vec(150, -48), name: 'Лампа подсветки',
      silk: 'HL1', nets: ['LAMP_A', 'GND'], comp: 'LAMP',
      rated: { pNom: 1.3, pMax: 2.2, tau: 0.9 },
    },
  ],

  wires: [
    { pts: [vec(-254, -35), vec(-254, -88), vec(-104, -88), vec(-104, -48)], net: 'VCC', via: 'LAMP', rated: 0.3 },
    { from: 'SLOT.b', to: 'LAMP.a', net: 'LAMP_A', via: 'LAMP', rated: 0.3 },
    {
      pts: [vec(184, -48), vec(250, -48), vec(250, 58), vec(-292, 58), vec(-292, -70), vec(-222, -70), vec(-222, -35)],
      net: 'GND', via: 'LAMP', rated: 0.3,
    },
  ],

  build(c) {
    addSupply(c, 'VCC', 'GND', 9.0, 'V1', SUPPLY_R.KRONA);
    const r1 = c.addResistor('VCC', 'LAMP_A', 10, 'R1');
    const lamp = addLamp(c, 'LAMP_A', 'GND', 30.0, 'LAMP');
    return { R1: r1, LAMP: lamp };
  },

  apply(refs, P, c) { c.setResistance(refs.R1, socketOhms(P.SLOT)); },

  read(sol, refs, P) {
    return {
      i: sol.componentCurrent['LAMP'] || 0,
      uLamp: sol.nodeVoltage['LAMP_A'] || 0,
      uRes: (sol.nodeVoltage['VCC'] || 0) - (sol.nodeVoltage['LAMP_A'] || 0),
      burnt: P.LAMP.burnt,
    };
  },

  status(m, P) {
    if (m.burnt) return ['Лампа перегорела — слишком много мощности на нити.', 'bad'];
    if (!P.SLOT.content) return ['Гнездо пустое, цепь разорвана.', 'neutral'];
    if (m.i > 0.24) return ['Лампа на пределе: так она долго не проживёт. Сопротивления не хватает.', 'bad'];
    if (m.i > 0.16) return ['Ярче, чем нужно. Дежурная подсветка не должна слепить.', 'warn'];
    if (m.i < 0.02) return ['Почти не светит: почти всё напряжение осело на резисторе.', 'warn'];
    if (m.i < 0.13) return ['Тускловато. Сопротивление великовато.', 'warn'];
    return ['Ровно дежурный режим. Так и надо.', 'good'];
  },

  goal(m) {
    if (m.burnt) return { ok: false, note: 'Лампа перегорела — замени её.' };
    return { ok: m.i >= 0.13 && m.i <= 0.16, note: 'Ток ' + fmtAmps(m.i) + ', нужно 130–160 мА.' };
  },

  score(m) { return m.burnt ? 0 : clamp(1 - Math.abs(m.i - 0.145) / 0.06, 0, 1); },
  scoreNote(m) { return 'На лампе ' + fmtVolts(m.uLamp) + ' · на резисторе ' + fmtVolts(m.uRes); },

  meter(m, P) {
    return [
      ['Ток через лампу', fmtAmps(m.i), m.i >= 0.13 && m.i <= 0.16 ? 'good' : (m.i > 0.16 ? 'warn' : '')],
      ['На лампе', fmtVolts(m.uLamp)],
      ['На резисторе', fmtVolts(m.uRes)],
      ['Мощность лампы', fmtWatts(P.LAMP.p)],
      ['Нагрев нити', Math.round(clamp(P.LAMP.heat, 0, 1) * 100) + '%', P.LAMP.heat > 0.8 ? 'bad' : ''],
    ];
  },
}));
