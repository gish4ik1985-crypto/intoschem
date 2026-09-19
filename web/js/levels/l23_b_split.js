'use strict';
// Б-15 · Общий балласт связывает ветки. Самое неочевидное место всей силовой
// части: вторая лампа не «просто добавляется» — она отбирает у первой.

(() => {
  const L = Rig.rows({
    id: 'b_split',
    board: DB.l.board,
    busX: { BUS: 0.40 },
    supply: { id: 'SUP', name: 'Ввод узла', label: '12 В', silk: 'G1', value: 12 },
    rows: [
      {
        id: 'BAL', to: 'BUS', rated: 0.4,
        items: [deckSocket('R0', 'Общий балласт', { silk: 'R0', title: 'Общий балласт узла', jumper: false, rated: { pMax: 3.5, tau: 1.2 } })],
      },
      {
        id: 'L1', from: 'BUS', rated: 0.2,
        items: [{ id: 'HL1', kind: 'lamp', name: 'Лампа левого борта', silk: 'HL1', value: 30, rated: { pNom: 0.8, pMax: 2.5, tau: 1.0 } }],
      },
      {
        id: 'L2', from: 'BUS', rated: 0.2,
        items: [
          deckToggle('SA1', 'Ключ правого борта', false, 'Нажми, чтобы включить или выключить вторую лампу'),
          { id: 'HL2', kind: 'lamp', name: 'Лампа правого борта', silk: 'HL2', value: 30, rated: { pNom: 0.8, pMax: 2.5, tau: 1.0 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'b_split',
    index: 37,
    title: 'Два борта на одном балласте',
    teaches: 'общий балласт связывает ветки',
    silk: 'SPL-2X-23',
    diag: 'ДИАГНОСТИКА · Узел Б-15: включение второй лампы гасит первую.',
    brief: 'Две лампы должны гореть одинаково и одновременно, каждая по 0,77 Вт. Балласт у них один на двоих, и он вынут. Записано наблюдение прежнего ремонта: «настроил первую — включил вторую, обе стали тусклее».',
    lesson: 'Общий балласт стоит до развилки, и ток через него — общий для обеих веток. Включив вторую лампу, ты уменьшаешь сопротивление после балласта вдвое: общий ток растёт, падение на балласте растёт, и до ламп доходит МЕНЬШЕ, чем доходило до одной. Поэтому балласт считают сразу на полную нагрузку, а не на ту, что включена сейчас.',
    reveal: 'Бортовые огни. Их включали парой — и, судя по записям, всегда обе сразу: одна горящая лампа с этого узла означала бы неисправность, а не экономию.',
    hints: [
      'Включи вторую лампу и посмотри, что стало с первой.',
      'Две лампы по 30 Ом рядом — это 15 Ом. Балласт считай на них вместе, а не на одну.',
      'Каждой лампе нужно 0,77 Вт, то есть около 4,8 В. Посчитай, сколько тогда должно остаться на балласте и какой при этом идёт ток.',
    ],
    codex: ['series', 'divider', 'power', 'lamp', 'current'],
    vmax: 12.0,
    hold: 3.0,
    scale: DB.l.scale,
    board: DB.l.board,
    map: { pos: vec(-752, 30), radius: 900, color: hex(0xffd166), from: ['b_branch', 'b_or'], icon: { kind: 'lamp' } },
    goalText: 'Обе лампы включены и каждая даёт 0,77 Вт (допуск ±10%).',
    scope: { label: 'Мощность левой лампы', get: (m) => m.p1, min: 0, max: 2.0, band: [0.693, 0.847], fmt: fmtWatts },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const uBus = sol.nodeVoltage.BUS || 0;
      const i1 = Math.abs(sol.componentCurrent.HL1 || 0);
      const i2 = Math.abs(sol.componentCurrent.HL2 || 0);
      const p1 = uBus * i1;
      const p2 = uBus * i2;
      return {
        uBus, i1, i2, p1, p2,
        iTotal: Math.abs(sol.componentCurrent.R0 || 0),
        both: !!P.SA1.closed,
        empty: !P.R0.content,
        ok: inPct(p1, 0.77, 0.10) && inPct(p2, 0.77, 0.10),
      };
    },

    status(m) {
      if (m.empty) return ['Балласт вынут — лампы не горят.', 'neutral'];
      if (!m.both) return ['Правый борт выключен. Настраивать надо на обе лампы сразу — включи вторую.', 'warn'];
      if (m.ok) return ['Оба борта горят одинаково и в паспортном режиме.', 'good'];
      if (m.p1 > 0.85) return ['Обе горят слишком ярко: балласт мал, до ламп доходит лишнее.', 'warn'];
      return ['Обе горят тускло: балласт велик и забирает себе слишком много.', 'warn'];
    },

    goal(m) {
      if (!m.both) return { ok: false, note: 'Вторая лампа выключена — узел настраивается только на обе сразу.' };
      return { ok: m.ok, note: 'Слева ' + fmtWatts(m.p1) + ', справа ' + fmtWatts(m.p2) + ', нужно по 0,77 Вт' };
    },

    score(m) { return m.both ? bandScore(m.p1, 0.77, 0.10) : 0; },
    scoreNote(m) { return 'Через общий балласт идёт ' + fmtAmps(m.iTotal) + ' — ровно сумма того, что берут обе лампы'; },

    meter(m) {
      return [
        ['Левый борт', fmtWatts(m.p1), inPct(m.p1, 0.77, 0.10) ? 'good' : 'warn'],
        ['Правый борт', m.both ? fmtWatts(m.p2) : 'выключен', m.both && inPct(m.p2, 0.77, 0.10) ? 'good' : 'warn'],
        ['На развилке', fmtVolts(m.uBus)],
        ['Через балласт', fmtAmps(m.iTotal)],
        ['Нужно каждой', '0,77 Вт'],
      ];
    },
  }));
})();
