'use strict';
// Е-13 · Мягкий источник. Резерв — это «крона»: самый мягкий источник в игре,
// у неё внутреннее сопротивление почти два ома. На таком источнике соседи по
// шине перестают быть независимыми, и настройка одной ветки видна на другой
// невооружённым глазом.

(() => {
  const L = Rig.rows({
    id: 'e_reserve',
    board: DB.m.board,
    supply: {
      id: 'SUP', name: 'Резервный источник', label: '9 В', silk: 'GB1',
      value: 9, rInt: SUPPLY_R.KRONA,
    },
    rated: 0.5,
    rows: [
      {
        id: 'A', rated: 0.4,
        items: [{ id: 'HL1', kind: 'lamp', name: 'Аварийное освещение', silk: 'HL1', value: 22, showValue: true, rated: { pNom: 3.0, pMax: 6.0, tau: 1.2 } }],
      },
      {
        id: 'B', rated: 0.3,
        items: [
          deckSocket('R1', 'Гнездо балласта', { silk: 'R1', title: 'Балласт второй ветки', jumper: false, rated: { pMax: 2.0, tau: 1.0 } }),
          { id: 'D1', kind: 'device', name: 'Передатчик', silk: 'A1', value: 10, showValue: true, rated: { pMax: 3.0, tau: 1.5 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'e_reserve',
    index: 74,
    title: 'Резервный источник',
    teaches: 'мягкий источник связывает соседей',
    silk: 'RSV-140-74',
    diag: 'ДИАГНОСТИКА · Узел Е-13: при включении передатчика аварийный свет гаснет.',
    brief: 'Питание идёт от резервной батареи на девять вольт — она мягкая, у неё заметное внутреннее сопротивление. Передатчику нужно 140 миллиампер, и при этом напряжение на шине не должно упасть ниже восьми вольт, иначе аварийное освещение гаснет.',
    lesson: 'У любого источника внутри есть сопротивление, и чем он меньше и слабее, тем оно больше. Ток, который берёт одна ветка, проходит и через это внутреннее сопротивление — а значит роняет напряжение сразу у всех, кто сидит на той же шине. На мощном блоке питания это доли вольта, на маленькой батарее — целые вольты. Отсюда правило: на слабом источнике нельзя настраивать ветку в отрыве от соседей, потому что они физически связаны через сам источник.',
    reveal: 'Резервное питание передатчика. Батарея на месте и не разряжена — просто её никогда не хватало на две вещи сразу, и выбирать приходилось: светить или звать.',
    hints: [
      'Смотри на напряжение шины, пока подбираешь балласт: оно ходит вместе с током.',
      'Чем больше берёт передатчик, тем ниже проседает шина — и тем меньше достаётся самому передатчику.',
      'Ищи между двумя условиями: 140 мА в ветке и не ниже восьми вольт на шине.',
    ],
    codex: ['battery', 'ohm', 'current', 'power', 'lamp'],
    vmax: 9.0,
    hold: 2.5,
    scale: DB.m.scale,
    board: DB.m.board,
    map: { pos: vec(0, 960), radius: 900, color: hex(0xffc46b), from: ['e_highside', 'e_fuse'], icon: { kind: 'krona' } },
    goalText: 'Ток передатчика 140 мА (±8%), напряжение шины не ниже 8 В.',
    scope: { label: 'Ток передатчика', get: (m) => m.iB, min: 0, max: 0.4, band: [0.1288, 0.1512], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const iA = Math.abs(sol.componentCurrent.HL1 || 0);
      const iB = Math.abs(sol.componentCurrent.D1 || 0);
      const vcc = sol.nodeVoltage.VCC || 0;
      return {
        iA, iB, vcc,
        total: iA + iB,
        empty: !P.R1.content,
        r: P.R1.content ? P.R1.content.value : 0,
        ok: inPct(iB, 0.14, 0.08) && vcc >= 8.0,
      };
    },

    status(m) {
      if (m.empty) return ['Ветка передатчика разомкнута — он молчит.', 'neutral'];
      if (m.ok) return ['Сто сорок миллиампер, и шина держит ' + fmtVolts(m.vcc) + '. Света хватает.', 'good'];
      if (m.vcc < 8) return ['Шина просела до ' + fmtVolts(m.vcc) + ': передатчик тянет слишком много и гасит свет.', 'warn'];
      if (m.iB > 0.1512) return ['Ток передатчика великоват.', 'warn'];
      return ['Ток передатчика маловат: балласт велик.', 'warn'];
    },

    goal(m) {
      if (m.vcc < 8) return { ok: false, note: 'Шина просела до ' + fmtVolts(m.vcc) + ', нужно не ниже 8 В' };
      return { ok: m.ok, note: 'Передатчик берёт ' + fmtAmps(m.iB) + ', нужно 140 мА' };
    },

    score(m) { return m.ok ? bandScore(m.iB, 0.14, 0.08) : 0; },
    scoreNote(m) { return 'Передатчик ' + fmtAmps(m.iB) + ' при шине ' + fmtVolts(m.vcc) + ' — свет не гаснет'; },

    meter(m) {
      return [
        ['Ток передатчика', m.empty ? '—' : fmtAmps(m.iB), m.ok ? 'good' : 'warn'],
        ['Напряжение шины', fmtVolts(m.vcc), m.vcc >= 8 ? 'good' : 'bad'],
        ['Ток освещения', fmtAmps(m.iA)],
        ['Отдаёт батарея', fmtAmps(m.total)],
        ['Нужно', '140 мА и не ниже 8 В'],
      ];
    },
  }));
})();
