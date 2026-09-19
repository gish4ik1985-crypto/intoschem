'use strict';
// Б-13 · Нужного номинала в ящике нет. Урок в лоб: два резистора рядом — это
// не «два раза по столько же», а меньше каждого из них по отдельности.

(() => {
  const KIT = RESISTOR_KIT;
  const L = Rig.rows({
    id: 'b_parallel',
    board: DB.s.board,
    supply: { id: 'SUP', name: 'Ввод нагревателя', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.2,
    rows: [
      { id: 'A', rated: 0.12, items: [deckSocket('RA', 'Первая спираль', { silk: 'RA', title: 'Первая спираль', jumper: false, kit: KIT, rated: { pMax: 2.4, tau: 1.0 } })] },
      { id: 'B', rated: 0.12, items: [deckSocket('RB', 'Вторая спираль', { silk: 'RB', title: 'Вторая спираль', jumper: false, kit: KIT, rated: { pMax: 2.4, tau: 1.0 } })] },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'b_parallel',
    index: 35,
    title: 'Спираль подогрева',
    teaches: 'параллельное соединение',
    silk: 'PAR-075-21',
    diag: 'ДИАГНОСТИКА · Узел Б-13: обе спирали сняты, потребления нет.',
    brief: 'Узел должен брать от шины ровно сто шестьдесят миллиампер — это семьдесят пять ом при двенадцати вольтах. Семидесяти пяти ом в ящике нет и не будет. Зато гнёзд два, и включены они рядом, а не друг за другом.',
    lesson: 'Два сопротивления рядом дают ток каждое своё, и токи складываются — значит общее сопротивление получается МЕНЬШЕ любого из них. Два одинаковых рядом — это ровно половина одного. Так и добывают номиналы, которых нет в ящике: сто пятьдесят и сто пятьдесят рядом — это семьдесят пять.',
    reveal: 'Подогрев приёмного тракта. Он не грел ничего важного — он держал температуру, при которой остальные измерения вообще имеют смысл.',
    hints: [
      'Обе спирали включены рядом, между одними и теми же шинами: напряжение на них одинаковое, а токи складываются.',
      'Нужно семьдесят пять ом. В ящике такого номинала нет — но два одинаковых рядом дают половину.',
      'Сто пятьдесят и сто пятьдесят.',
    ],
    codex: ['ohm', 'series', 'current', 'resistor', 'power'],
    vmax: 12.0,
    hold: 2.5,
    scale: DB.s.scale,
    board: DB.s.board,
    map: { pos: vec(-322, 30), radius: 900, color: hex(0xff9a3c), from: ['b_reference', 'b_ballast'], icon: { kind: 'resistor', value: 150 } },
    goalText: 'Общий ток узла — 160 мА (допуск ±7%).',
    scope: { label: 'Общий ток узла', get: (m) => m.total, min: 0, max: 0.3, band: [0.1488, 0.1712], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const ia = Math.abs(sol.componentCurrent.RA || 0);
      const ib = Math.abs(sol.componentCurrent.RB || 0);
      const total = ia + ib;
      return {
        ia, ib, total,
        rEq: total > 1e-6 ? (sol.nodeVoltage.VCC || 0) / total : NaN,
        both: !!P.RA.content && !!P.RB.content,
        ok: inPct(total, 0.16, 0.07),
      };
    },

    status(m) {
      if (!m.both) return ['Стоит только одна спираль. Одна не даст нужного тока, сколько её ни подбирай.', 'neutral'];
      if (m.ok) return ['Сто шестьдесят миллиампер. Две спирали вместе дают то, чего не даёт ни одна.', 'good'];
      if (m.total > 0.171) return ['Тока многовато: общее сопротивление получилось меньше семидесяти пяти ом.', 'warn'];
      return ['Тока маловато: общее сопротивление получилось больше семидесяти пяти ом.', 'warn'];
    },

    goal(m) {
      return { ok: m.ok, note: 'Узел берёт ' + fmtAmps(m.total) + ', нужно 160 мА' };
    },

    score(m) { return bandScore(m.total, 0.16, 0.07); },
    scoreNote(m) { return 'Общее сопротивление узла ' + fmtOhms(m.rEq) + ' — и ни одной такой детали в ящике нет'; },

    meter(m) {
      return [
        ['Первая спираль', fmtAmps(m.ia)],
        ['Вторая спираль', fmtAmps(m.ib)],
        ['Вместе', fmtAmps(m.total), m.ok ? 'good' : 'warn'],
        ['Общее сопротивление', fmtOhms(m.rEq)],
        ['Нужно', '160 мА · 75 Ом'],
      ];
    },
  }));
})();
