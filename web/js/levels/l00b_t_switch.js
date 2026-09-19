'use strict';
// Т-02 · Ключ. Второе, что надо понять про кольцо: разрыв бывает не только
// аварийный, но и нарочный, и тогда он называется ключом. Заодно первый
// неочевидный факт: на разомкнутом ключе стоит ВСЁ напряжение источника.

(() => {
  const L = Rig.rows({
    id: 't_switch',
    board: DB.s.board,
    supply: { id: 'SUP', name: 'Питание стенда', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.25,
    rows: [
      {
        id: 'LP', rated: 0.25,
        items: [
          deckToggle('SA1', 'Ключ стенда', false, 'Нажми, чтобы замкнуть или разомкнуть'),
          { id: 'R1', kind: 'resistor', name: 'Балласт', silk: 'R1', value: 47, showValue: true, rated: { pMax: 3.0, tau: 1.0 } },
          { id: 'HL1', kind: 'lamp', name: 'Контрольная лампа', silk: 'HL1', value: 22, rated: { pNom: 0.66, pMax: 3.0, tau: 1.2 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 't_switch',
    index: 2,
    title: 'Ключ',
    teaches: 'ключ — это разрыв, которым управляют',
    silk: 'STD-002',
    diag: 'СТЕНД · Сборка Т-02: ключ разомкнут, тока нет.',
    brief: 'Здесь всё на месте: балласт стоит, лампа целая. Разомкнут только ключ. Прежде чем его замкнуть, посмотри на приборы: где сейчас находятся все двенадцать вольт.',
    lesson: 'Ключ — тот же разрыв кольца, только сделанный нарочно и обратимо. Пока он разомкнут, тока нет нигде, и всё напряжение источника стоит на самом ключе: на двух его контактах, между которыми воздух. Как только он замкнулся, напряжение с него уходит и делится между теми, кто реально мешает току, — балластом и лампой.',
    reveal: 'Пункт второй: «Всё, что здесь выключено, выключил я. Ничего не сгорело. Я гасил по одному, чтобы запаса хватило подольше».',
    hints: [
      'Нажми на ключ — он щёлкает.',
      'Посмотри на строку «На ключе» до и после щелчка.',
      'Разомкнутый ключ забирает себе всё напряжение источника. Замкнутый не забирает почти ничего.',
    ],
    codex: ['switch', 'circuit', 'current', 'ohm'],
    vmax: 12.0,
    hold: 1.5,
    scale: DB.s.scale,
    board: DB.s.board,
    map: { pos: vec(-215, -1250), radius: 900, color: hex(0x6ee7a8), from: 't_loop', icon: { kind: 'toggle' } },
    goalText: 'Замкни ключ — лампа должна загореться.',
    scope: { label: 'Ток в кольце', get: (m) => m.i, min: 0, max: 0.25, band: [0.05, 0.25], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const i = Math.abs(sol.componentCurrent.HL1 || 0);
      const vcc = sol.nodeVoltage.VCC || 0;
      return {
        i, on: !!P.SA1.closed,
        uKey: vcc - (sol.nodeVoltage.LP_1 || 0),
        uRes: (sol.nodeVoltage.LP_1 || 0) - (sol.nodeVoltage.LP_2 || 0),
        uLamp: sol.nodeVoltage.LP_2 || 0,
        ok: i > 0.05,
      };
    },

    status(m) {
      if (m.ok) return ['Ключ замкнут. Напряжение с него ушло и разделилось между балластом и лампой.', 'good'];
      return ['Ключ разомкнут. Тока нет, и все двенадцать вольт стоят на самом ключе.', 'neutral'];
    },

    goal(m) {
      return { ok: m.ok, note: m.ok ? 'Ток ' + fmtAmps(m.i) : 'Ключ разомкнут — кольца нет' };
    },

    score(m) { return m.ok ? 1 : 0; },
    scoreNote(m) { return 'Ток ' + fmtAmps(m.i) + ': на балласте ' + fmtVolts(m.uRes) + ', на лампе ' + fmtVolts(m.uLamp); },

    meter(m) {
      return [
        ['Ток в кольце', fmtAmps(m.i), m.ok ? 'good' : ''],
        ['На ключе', fmtVolts(m.uKey), m.on ? '' : 'warn'],
        ['На балласте', fmtVolts(m.uRes)],
        ['На лампе', fmtVolts(m.uLamp)],
      ];
    },
  }));
})();
