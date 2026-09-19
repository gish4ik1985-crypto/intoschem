'use strict';
// Е-02 · Обратная полярность. Ввод сюда приходит снаружи, и полярность на нём
// не гарантирована никем: узел сам переворачивает её раз в полторы секунды.
// Поэтому здесь мало «чтобы работало» — надо, чтобы при обратной полярности
// НЕ работало и при этом ничего не выгорело.

(() => {
  const L = Rig.rows({
    id: 'e_polarity',
    board: DB.s.board,
    supply: { id: 'SUP', name: 'Ввод снаружи', label: '±12 В', silk: 'G1', value: 12 },
    rated: 0.3,
    rows: [
      {
        id: 'IN', rated: 0.3,
        items: [
          {
            id: 'VD', kind: 'socket', name: 'Гнездо защиты', silk: 'VD1',
            showValue: true, valueText: socketLabel, content: null,
            rated: { pMax: 3.0, tau: 1.0 },
            interact: {
              type: 'pick', title: 'Что поставить в защиту',
              hint: 'Нажми, чтобы выбрать',
              options: () => diodeOptions({ empty: true, jumper: true }),
            },
          },
          { id: 'HL1', kind: 'lamp', name: 'Нагрузка ввода', silk: 'HL1', value: 68, showValue: true, rated: { pNom: 1.9, pMax: 5.0, tau: 1.2 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'e_polarity',
    index: 63,
    title: 'Обратная полярность',
    teaches: 'диод защищает от переполюсовки',
    silk: 'POL-165-63',
    diag: 'ДИАГНОСТИКА · Узел Е-02: полярность ввода меняется, защита не поставлена.',
    brief: 'Кабель приходит снаружи, и полярность на нём то прямая, то обратная — узел переключает её сам, раз в полторы секунды, смотри на ленту. Нужно, чтобы при прямой полярности нагрузка получала не меньше 150 мА, а при обратной — не больше 5 мА.',
    lesson: 'Перемычка честно пропускает ток в обе стороны — и в обратную тоже, а обратный ток для многих узлов означает конец. Диод, поставленный последовательно, пропускает только в свою сторону: при прямой полярности он забирает себе меньше вольта, при обратной запирается наглухо и держит на себе всё напряжение. Это самая дешёвая защита от переполюсовки, какая бывает, и стоит она ровно одну деталь.',
    reveal: 'Ввод внешнего кабеля. Он идёт наверх, к точке подъёма, и полярность на нём никогда не была постоянной: кабель раз за разом подключали вслепую, на ощупь, в темноте.',
    hints: [
      'Смотри на ленту самописца: ток меняется сам, потому что меняется полярность ввода.',
      'Перемычка пропускает ток в обе стороны одинаково — посмотри, что при этом делается при обратной полярности.',
      'Диод пропускает только в одну сторону. Полоска на корпусе — тот конец, из которого ток выйти не может.',
    ],
    codex: ['diode', 'current', 'circuit', 'lamp'],
    vmax: 12.0,
    hold: 2.5,
    testSeconds: 8,
    scale: DB.s.scale,
    board: DB.s.board,
    topologyKey: (P) => (P.VD.content ? (P.VD.content.kind === 'jumper' ? 'j' : (P.VD.content.flipped ? 'r' : 'f')) : 'x'),
    map: { pos: vec(-215, 630), radius: 900, color: hex(0xff8a4a), from: 'e_listen', icon: { kind: 'diode' } },
    goalText: 'Прямая полярность — не меньше 150 мА, обратная — не больше 5 мА.',
    scope: { label: 'Ток нагрузки', get: (m) => m.i, min: -0.3, max: 0.3, band: [0.15, 0.3], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    // Знак ЭДС входит в правую часть, которая пересобирается каждый шаг, —
    // метить матрицу грязной для этого не надо.
    apply: (refs, P, c) => {
      Rig.apply(c, refs, P);
      if (refs.V1) refs.V1.voltage = P.SUP.rev ? -12 : 12;
    },

    // Ввод сам переворачивается: полторы секунды прямой полярности, полторы
    // обратной. Ток каждой фазы запоминается отдельно — сравнивать надо две
    // разные фазы, а на экране в каждый момент видна только одна.
    tick(dt, P, m) {
      P.SUP.t = (P.SUP.t || 0) + dt;
      P.SUP.rev = (P.SUP.t % 3) > 1.5;
      if (P.SUP.rev) P.SUP.iRev = Math.abs(m.i);
      else P.SUP.iFwd = Math.abs(m.i);
    },

    read(sol, refs, P) {
      const i = sol.componentCurrent.HL1 || 0;
      const fwd = P.SUP.iFwd === undefined ? 0 : P.SUP.iFwd;
      const rev = P.SUP.iRev === undefined ? 9 : P.SUP.iRev;
      return {
        i, fwd, rev,
        reversed: !!P.SUP.rev,
        empty: !P.VD.content,
        jumper: !!P.VD.content && P.VD.content.kind === 'jumper',
        uProt: (sol.nodeVoltage.VCC || 0) - (sol.nodeVoltage.IN_1 || 0),
        ok: fwd >= 0.15 && rev <= 0.005,
      };
    },

    status(m) {
      if (m.empty) return ['Гнездо защиты пустое — ввод разомкнут в обе стороны.', 'neutral'];
      if (m.ok) return ['Прямую полярность защита пропускает, обратную запирает. Так и должно быть.', 'good'];
      if (m.jumper) return ['Перемычка пропускает ток и назад: при обратной полярности через нагрузку идёт столько же, только в другую сторону.', 'bad'];
      if (m.fwd < 0.15) return ['При прямой полярности ток не проходит: защита стоит не той стороной.', 'bad'];
      return ['Обратный ток великоват — защита не запирается.', 'warn'];
    },

    goal(m) {
      if (m.empty) return { ok: false, note: 'Защита не поставлена.' };
      if (m.fwd < 0.15) return { ok: false, note: 'При прямой полярности всего ' + fmtAmps(m.fwd) + ', нужно 150 мА' };
      return { ok: m.rev <= 0.005, note: 'При обратной полярности ' + fmtAmps(m.rev) + ', разрешено 5 мА' };
    },

    score(m) { return m.ok ? 1 : 0; },
    scoreNote(m) { return 'Прямо ' + fmtAmps(m.fwd) + ', обратно ' + fmtAmps(m.rev) + ' — защита держит'; },

    meter(m) {
      return [
        ['Полярность сейчас', m.reversed ? 'обратная' : 'прямая', m.reversed ? 'warn' : 'good'],
        ['Ток сейчас', fmtAmps(Math.abs(m.i))],
        ['При прямой', fmtAmps(m.fwd), m.fwd >= 0.15 ? 'good' : 'warn'],
        ['При обратной', m.rev > 8 ? '—' : fmtAmps(m.rev), m.rev <= 0.005 ? 'good' : 'bad'],
        ['На защите', m.empty ? '—' : fmtVolts(Math.abs(m.uProt))],
      ];
    },
  }));
})();
