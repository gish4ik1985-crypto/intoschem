'use strict';
// Е-05 · Два вместо одного, но теперь ПАРАЛЛЕЛЬНО. Зеркало к балласту из
// силовой части: там одно и то же сопротивление раскладывали на два
// последовательных, здесь — на два параллельных. Отсев тот же: одиночный
// резистор даёт правильный ток и сгорает, потому что всё тепло достаётся
// ему одному.

(() => {
  const L = Rig.rows({
    id: 'e_pair',
    board: DB.l.board,
    busX: { BAL: 0.55 },
    supply: { id: 'SUP', name: 'Ввод узла', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.25,
    rows: [
      {
        id: 'P1', to: 'BAL', rated: 0.15,
        items: [deckSocket('R1', 'Верхнее гнездо', { silk: 'R1', title: 'Верхнее гнездо балласта', jumper: false, rated: { pMax: 1.0, tau: 1.0 } })],
      },
      {
        id: 'P2', to: 'BAL', rated: 0.15,
        items: [deckSocket('R2', 'Нижнее гнездо', { silk: 'R2', title: 'Нижнее гнездо балласта', jumper: false, rated: { pMax: 1.0, tau: 1.0 } })],
      },
      {
        id: 'LD', from: 'BAL', rated: 0.25,
        items: [{ id: 'HL1', kind: 'lamp', name: 'Прожектор', silk: 'HL1', value: 22, showValue: true, rated: { pNom: 1.0, pMax: 3.0, tau: 1.2 } }],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'e_pair',
    index: 66,
    title: 'Два вместо одного',
    teaches: 'параллельные резисторы делят тепло',
    silk: 'PAR-200-66',
    diag: 'ДИАГНОСТИКА · Узел Е-05: оба гнезда балласта пустые, гнёзда рассчитаны на 1 Вт.',
    brief: 'Прожектору нужно 200 миллиампер. Гнёзд под балласт два, но стоят они не друг за другом, а рядом — параллельно. Каждое гнездо держит только один ватт: больше — сгорит.',
    lesson: 'Два одинаковых резистора рядом дают вдвое меньшее сопротивление, чем один: ток находит два пути вместо одного. И ровно так же делится между ними тепло — каждому достаётся половина. Поэтому нужный балласт часто набирают парой более крупных номиналов параллельно: сопротивление получается то же самое, ток тот же самый, а мощность на каждой детали вдвое меньше предела.',
    reveal: 'Балласт прожектора точки подъёма. В гнёздах следы двух резисторов, а рядом на плате нацарапано: «по одному не ставить». Кто-то уже пробовал.',
    hints: [
      'Поставь сначала один резистор и посмотри на его нагрев — гнездо держит только ватт.',
      'Два одинаковых резистора рядом дают вдвое меньшее сопротивление, чем один такой же.',
      'Нужно около 38 ом на весь балласт. Два по 68 параллельно дают 34 — и каждому достаётся половина тепла.',
    ],
    codex: ['power', 'series', 'resistor', 'ohm', 'lamp'],
    vmax: 12.0,
    hold: 3.0,
    scale: DB.l.scale,
    board: DB.l.board,
    map: { pos: vec(430, 630), radius: 900, color: hex(0xff5b3d), from: 'e_share', icon: { kind: 'resistor', value: 68 } },
    goalText: 'Ток 200 мА (±8%), и балласт должен это выдержать три секунды.',
    scope: { label: 'Ток прожектора', get: (m) => m.i, min: 0, max: 0.4, band: [0.184, 0.216], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const i = Math.abs(sol.componentCurrent.HL1 || 0);
      const uBal = (sol.nodeVoltage.VCC || 0) - (sol.nodeVoltage.BAL || 0);
      const i1 = Math.abs(sol.componentCurrent.R1 || 0);
      const i2 = Math.abs(sol.componentCurrent.R2 || 0);
      return {
        i, uBal, i1, i2,
        p1: uBal * i1, p2: uBal * i2,
        heat: Math.max(P.R1.heat || 0, P.R2.heat || 0),
        burnt: !!P.R1.burnt || !!P.R2.burnt,
        alone: (!P.R1.content) !== (!P.R2.content),
        empty: !P.R1.content && !P.R2.content,
        ok: !P.R1.burnt && !P.R2.burnt && inPct(i, 0.2, 0.08),
      };
    },

    status(m) {
      if (m.burnt) return ['Гнездо выгорело: ток был правильный, а весь ватт достался одной детали. Замени и раздели балласт на два.', 'bad'];
      if (m.empty) return ['Оба гнезда пустые — цепь разомкнута.', 'neutral'];
      if (m.ok && m.heat > 0.8) return ['Ток правильный, но балласт на пределе — долго он так не простоит.', 'warn'];
      if (m.ok) return ['Двести миллиампер, и оба гнезда греются вполсилы.', 'good'];
      if (m.i > 0.216) return ['Тока многовато: балласт в сумме слишком мал.', 'warn'];
      return ['Тока маловато: балласт в сумме слишком велик.', 'warn'];
    },

    goal(m) {
      if (m.burnt) return { ok: false, note: 'Балласт выгорел — замени и раздели его на два.' };
      return { ok: m.ok, note: 'Ток ' + fmtAmps(m.i) + ', нужно 200 мА' };
    },

    score(m) { return m.burnt ? 0 : bandScore(m.i, 0.2, 0.08) * (1 - clamp(m.heat, 0, 1) * 0.2); },
    scoreNote(m) { return 'Ток ' + fmtAmps(m.i) + ' при нагреве гнёзд ' + Math.round(clamp(m.heat, 0, 1) * 100) + '% — запас есть'; },

    meter(m) {
      return [
        ['Ток прожектора', fmtAmps(m.i), m.ok ? 'good' : 'warn'],
        ['Греется верхнее', m.empty ? '—' : fmtWatts(m.p1)],
        ['Греется нижнее', m.empty ? '—' : fmtWatts(m.p2)],
        ['Нагрев балласта', Math.round(clamp(m.heat, 0, 1) * 100) + '%', m.heat > 0.8 ? 'bad' : ''],
        ['Предел гнезда', '1,0 Вт'],
      ];
    },
  }));
})();
