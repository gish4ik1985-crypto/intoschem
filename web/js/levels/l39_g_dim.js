'use strict';
// Г-06 · Регулятор с защитой. Первый узел, где считать надо не рабочую точку,
// а САМОЕ ХУДШЕЕ положение органа управления. Ручку выкрутят до упора — не
// потому что дурак, а потому что упор для того и сделан.

(() => {
  const MIN_KIT = [10, 12, 15, 18, 22, 27];
  const L = Rig.rows({
    id: 'g_dim',
    board: DB.s.board,
    supply: { id: 'SUP', name: 'Ввод осветителя', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.3,
    rows: [
      {
        id: 'DM', rated: 0.3,
        items: [
          deckSocket('RMIN', 'Нижний предел', { silk: 'R1', title: 'Что ограничит ручку снизу', jumper: false, kit: MIN_KIT, rated: { pMax: 2.5, tau: 1.2 } }),
          {
            id: 'RP', kind: 'pot', name: 'Ручка яркости', silk: 'RP',
            value: 200, knob: 0, rated: { pMax: 4.0, tau: 1.5 },
            interact: {
              type: 'knob', hint: 'Крути колесом мыши или тяни вверх-вниз',
              map: (k) => Math.round(lerp(200, 1, clamp(k, 0, 1))),
            },
          },
          { id: 'HL1', kind: 'lamp', name: 'Осветитель', silk: 'HL1', value: 30, rated: { pNom: 1.9, pMax: 2.1, tau: 1.0 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'g_dim',
    index: 53,
    title: 'Регулятор с защитой',
    teaches: 'считать по худшему положению ручки',
    silk: 'DIM-015-39',
    diag: 'ДИАГНОСТИКА · Узел Г-06: осветитель выгорает при выкручивании ручки до упора.',
    brief: 'Осветитель яркостью управляют ручкой. В крайнем верхнем положении ручка не даёт ничего — и весь ток тогда ограничивает только то, что стоит в гнезде нижнего предела. Оно пустое. Паспорт: на полном ходу осветитель обязан выдавать не меньше 1,75 Вт и не сгорать.',
    lesson: 'Регулятор проверяют не в удобной точке, а в самой тяжёлой — там, где он убран до конца. Что стоит рядом с ним постоянно, то и решает, выживет деталь или нет. Отсюда правило: рядом с любой ручкой всегда есть неснимаемый предел, и считают именно его, а не рабочее положение.',
    reveal: 'Осветитель приёмного окна, тот самый, что светил наружу. Гнездо предела пустое — предел вынули, чтобы получить побольше света. Лампа после этого прожила недолго.',
    hints: [
      'Выкрути ручку до упора и посмотри, сколько мощности приходится на осветитель.',
      'На упоре ручка не даёт сопротивления совсем: остаётся только гнездо предела и сама лампа.',
      'Нужно не меньше 1,75 Вт и не больше того, что лампа выдержит. Между этими двумя условиями остаётся узкий выбор.',
    ],
    codex: ['power', 'resistor', 'ohm', 'lamp'],
    vmax: 12.0,
    hold: 3.0,
    scale: DB.s.scale,
    board: DB.s.board,
    map: { pos: vec(-752, 415), radius: 900, color: hex(0xffc46b), from: ['g_latch', 'g_interlock'], icon: { kind: 'lamp' } },
    goalText: 'Ручка на упоре, осветитель даёт не меньше 1,75 Вт и не горит.',
    scope: { label: 'Мощность осветителя', get: (m) => m.p, min: 0, max: 3, band: [1.75, 2.1], fmt: fmtWatts },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const i = Math.abs(sol.componentCurrent.HL1 || 0);
      const uLamp = sol.nodeVoltage.DM_2 || 0;
      return {
        i,
        p: uLamp * i,
        rp: P.RP.value,
        atStop: P.RP.value <= 3,
        heat: P.HL1.heat || 0,
        burnt: !!P.HL1.burnt,
        empty: !P.RMIN.content,
        ok: P.RP.value <= 3 && !P.HL1.burnt && uLamp * i >= 1.75,
      };
    },

    status(m) {
      if (m.burnt) return ['Осветитель сгорел. Предел в гнезде слишком мал — на упоре ручки лампа получает больше, чем выдерживает.', 'bad'];
      if (m.empty) return ['Гнездо предела пустое — цепь разомкнута.', 'neutral'];
      if (m.ok && m.heat > 0.9) return ['Мощность есть, но лампа на самом краю: запас почти нулевой.', 'warn'];
      if (m.ok) return ['На упоре ручки лампа даёт паспортную мощность и держит нагрев.', 'good'];
      if (!m.atStop) return ['Проверять надо на упоре: выкрути ручку до конца.', 'warn'];
      return ['На упоре всего ' + fmtWatts(m.p) + ' — предел в гнезде слишком велик.', 'warn'];
    },

    goal(m) {
      if (m.burnt) return { ok: false, note: 'Осветитель сгорел — замени и поставь предел побольше.' };
      if (!m.atStop) return { ok: false, note: 'Ручка не на упоре: ' + fmtOhms(m.rp) };
      return { ok: m.p >= 1.75, note: 'На упоре ' + fmtWatts(m.p) + ', нужно не меньше 1,75 Вт' };
    },

    score(m) { return m.ok ? clamp(0.6 + (1 - clamp(m.heat, 0, 1)) * 1.6, 0.6, 1) : 0; },
    scoreNote(m) { return 'На упоре ручки ' + fmtWatts(m.p) + ' при нагреве лампы ' + Math.round(clamp(m.heat, 0, 1) * 100) + '%'; },

    meter(m) {
      return [
        ['Мощность осветителя', fmtWatts(m.p), m.p >= 1.75 ? 'good' : 'warn'],
        ['Ручка', fmtOhms(m.rp) + (m.atStop ? ' · упор' : '')],
        ['Ток', fmtAmps(m.i)],
        ['Нагрев лампы', Math.round(clamp(m.heat, 0, 1) * 100) + '%', m.heat > 0.9 ? 'bad' : ''],
        ['Нужно', 'не меньше 1,75 Вт'],
      ];
    },
  }));
})();
