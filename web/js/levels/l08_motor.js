'use strict';
// Уровень 8 · Привод заслонки.
// Полярность. Диод стоит правильно и честно не пускает ток назад —
// а один из элементов вставлен наоборот и гасит второй.

const Level08 = createLevel(LevelRegistry.register({
  id: 'motor',
  index: 22,
  title: 'Привод заслонки',
  teaches: 'полярность · диод',
  silk: 'DRV-SHT-08',
  diag: 'ДИАГНОСТИКА · Привод заслонки не запускается при исправных деталях.',
  brief: 'Мотор не крутится, хотя обе батарейки свежие и цепь цела. Защитный диод на месте и работает как положено.',
  lesson: 'Батарейки в цепочке складываются только тогда, когда смотрят в одну сторону: перевёрнутая вычитается из остальных. А диод пропускает ток лишь в одну сторону — поэтому при перепутанной полярности мотор не сломается, но и не поедет.',
  hints: [
    'Наведи курсор на батарейки и посмотри, сколько вольт даёт каждая.',
    'Плюс одной должен смотреть в минус следующей. Найди ту, что смотрит не туда.',
    'Переворачивать надо батарейку, а не диод: диод как раз и защищает мотор от неверной полярности.',
  ],
  codex: ['diode', 'motor', 'battery', 'circuit'],
  vmax: 3.0,
  hold: 2.5,
  map: { pos: vec(-322, -535), radius: 900, color: hex(0xc79bff), from: ['led', 'heater'], icon: { kind: 'motor' } },
  goalText: 'Мотор должен крутиться в полную силу.',
  scope: { label: 'Ток через мотор', get: (m) => m.i, min: -0.02, max: 0.09, band: [0.045, 0.08], fmt: fmtAmps },

  parts: [
    {
      id: 'BAT1', kind: 'cell', pos: vec(-230, -48), name: 'Батарейка 1', label: '1,5 В',
      silk: 'BT1', nets: ['MID', 'GND'], comp: 'V1', flipped: false,
      interact: { type: 'flip', hint: 'Нажми, чтобы перевернуть элемент' },
    },
    {
      id: 'BAT2', kind: 'cell', pos: vec(-90, -48), name: 'Батарейка 2', label: '1,5 В',
      silk: 'BT2', nets: ['VCC', 'MID'], comp: 'V2', flipped: true,
      interact: { type: 'flip', hint: 'Нажми, чтобы перевернуть элемент' },
    },
    { id: 'VD', kind: 'diode', pos: vec(60, -48), name: 'Защитный диод', silk: 'VD1', nets: ['VCC', 'D_OUT'], comp: 'DIODE' },
    {
      id: 'MOT', kind: 'motor', pos: vec(210, -48), name: 'Мотор заслонки',
      silk: 'M1', nets: ['D_OUT', 'GND'], comp: 'MOTOR',
      rated: { iNom: 0.064, pMax: 1.2, tau: 0.8 },
    },
  ],

  wires: [
    { from: 'BAT1.b', to: 'BAT2.a', net: 'MID', via: 'MOTOR', rated: 0.07 },
    { from: 'BAT2.b', to: 'VD.a', net: 'VCC', via: 'MOTOR', rated: 0.07 },
    { from: 'VD.b', to: 'MOT.a', net: 'D_OUT', via: 'MOTOR', rated: 0.07 },
    { pts: [vec(253, -26), vec(280, -26), vec(280, 60), vec(-282, 60), vec(-282, -48)], net: 'GND', via: 'MOTOR', rated: 0.07 },
  ],

  build(c) {
    const v1 = addSupply(c, 'MID', 'GND', 1.5, 'V1', SUPPLY_R.AA_CELL);
    const v2 = addSupply(c, 'VCC', 'MID', 1.5, 'V2', SUPPLY_R.AA_CELL);
    c.addDiode('VCC', 'D_OUT', 'DIODE');
    const motor = addMotor(c, 'D_OUT', 'GND', 47.0, 'MOTOR');
    return { V1: v1, V2: v2, MOTOR: motor };
  },

  // Перевёрнутый элемент — это та же батарейка, включённая наоборот:
  // её ЭДС просто меняет знак.
  apply(refs, P) {
    refs.V1.voltage = P.BAT1.flipped ? -1.5 : 1.5;
    refs.V2.voltage = P.BAT2.flipped ? -1.5 : 1.5;
  },

  read(sol, refs, P) {
    return {
      i: sol.componentCurrent['MOTOR'] || 0,
      pack: sol.nodeVoltage['VCC'] || 0,
      uDiode: (sol.nodeVoltage['VCC'] || 0) - (sol.nodeVoltage['D_OUT'] || 0),
      flipped: (P.BAT1.flipped ? 1 : 0) + (P.BAT2.flipped ? 1 : 0),
    };
  },

  status(m) {
    if (Math.abs(m.pack) < 0.1) return ['На выходе батарей ноль: элементы смотрят навстречу друг другу и гасят друг друга.', 'bad'];
    if (m.pack < -0.1) return ['Полярность перевёрнута целиком. Диод не пускает ток назад — мотор стоит, но цел.', 'warn'];
    if (m.i > 0.045) return ['Мотор крутится в полную силу. Полярность верная.', 'good'];
    return ['Ток есть, но мало. Проверь оба элемента.', 'warn'];
  },

  goal(m) {
    return { ok: m.i > 0.045, note: 'Ток через мотор ' + fmtAmps(m.i) + ' · на выходе батарей ' + fmtVolts(m.pack) };
  },

  score(m) { return clamp(m.i / 0.064, 0, 1); },
  scoreNote(m) { return 'На диоде теряется ' + fmtVolts(m.uDiode) + ' — цена односторонности'; },

  meter(m, P) {
    return [
      ['Ток мотора', fmtAmps(m.i), m.i > 0.045 ? 'good' : (Math.abs(m.i) < 1e-5 ? 'bad' : 'warn')],
      ['Выход батарей', fmtVolts(m.pack), Math.abs(m.pack) < 0.1 ? 'bad' : ''],
      ['Батарейка 1', fmtVolts(P.BAT1.flipped ? -1.5 : 1.5)],
      ['Батарейка 2', fmtVolts(P.BAT2.flipped ? -1.5 : 1.5)],
      ['Падение на диоде', fmtVolts(m.uDiode)],
    ];
  },
}));
