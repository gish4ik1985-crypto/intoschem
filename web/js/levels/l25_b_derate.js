'use strict';
// Б-17 · Нужный ток даёт и один резистор, и два. Один из них сгорает.
// Урок, которого до сих пор в игре не было: у детали есть не только номинал,
// но и предел мощности, и считать надо оба.

(() => {
  const KIT = [10, 22, 33, 47, 68, 100];
  const L = Rig.rows({
    id: 'b_derate',
    board: DB.m.board,
    supply: { id: 'SUP', name: 'Ввод узла', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.25,
    rows: [
      {
        id: 'BAL', rated: 0.25,
        items: [
          deckSocket('R1', 'Первое гнездо', { silk: 'R1', title: 'Первое гнездо балласта', jumper: true, kit: KIT, rated: { pMax: 1.5, tau: 1.0 } }),
          deckSocket('R2', 'Второе гнездо', { silk: 'R2', title: 'Второе гнездо балласта', jumper: true, kit: KIT, rated: { pMax: 1.5, tau: 1.0 } }),
          { id: 'HL1', kind: 'lamp', name: 'Контрольная лампа', silk: 'HL1', value: 10, rated: { pNom: 0.5, pMax: 3.0, tau: 1.0 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'b_derate',
    index: 39,
    title: 'Балласт, который выдержит',
    teaches: 'предел мощности детали',
    silk: 'DRT-220-25',
    diag: 'ДИАГНОСТИКА · Узел Б-17: балласт выгорает при каждой попытке пуска.',
    brief: 'Узлу нужно 220 мА. Гнёзд под балласт два, включены друг за другом, и оба пустые. В памяти узла записаны три предыдущих ремонта: каждый раз ток выходил правильный, и каждый раз балласт через пару секунд выгорал.',
    lesson: 'Сопротивление задаёт ток, но греется деталь не от тока и не от напряжения по отдельности, а от их произведения — и вся эта мощность выделяется в ней одной. Разложи то же сопротивление на два резистора подряд: ток остался прежним, а каждому досталась половина падения, то есть половина тепла. Поэтому два по двадцать два выживают там, где один на сорок семь сгорает.',
    reveal: 'Балласт пускового тракта. Три отметки о ремонте — три разных почерка. Последняя запись сделана тем же почерком, что и вся остальная плата.',
    hints: [
      'Наведи курсор на гнёзда: кроме тока там видно мощность и нагрев каждого.',
      'Нужное сопротивление можно набрать одним резистором или двумя подряд — ток получится тот же.',
      'Мощность на резисторе — это его ток, умноженный на падение НА НЁМ. Два одинаковых подряд делят падение пополам, а значит и тепло.',
    ],
    codex: ['power', 'series', 'resistor', 'ohm', 'short'],
    vmax: 12.0,
    hold: 3.0,
    scale: DB.m.scale,
    board: DB.m.board,
    map: { pos: vec(-1182, 30), radius: 900, color: hex(0xff5b3d), from: ['sag', 'b_inrush'], icon: { kind: 'resistor', value: 22 } },
    goalText: 'Ток 220 мА (±7%), и балласт должен выдержать это три секунды.',
    scope: { label: 'Ток узла', get: (m) => m.i, min: 0, max: 0.5, band: [0.2046, 0.2354], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const i = Math.abs(sol.componentCurrent.HL1 || 0);
      const p1 = Math.abs(((sol.nodeVoltage.VCC || 0) - (sol.nodeVoltage.BAL_1 || 0)) * i);
      const p2 = Math.abs(((sol.nodeVoltage.BAL_1 || 0) - (sol.nodeVoltage.BAL_2 || 0)) * i);
      return {
        i, p1, p2,
        heat: Math.max(P.R1.heat || 0, P.R2.heat || 0),
        burnt: !!P.R1.burnt || !!P.R2.burnt,
        empty: !P.R1.content && !P.R2.content,
        ok: inPct(i, 0.22, 0.07),
      };
    },

    status(m) {
      if (m.burnt) return ['Балласт выгорел. Ток был правильный — не выдержала мощность. Замени и раздели её на два резистора.', 'bad'];
      if (m.empty) return ['Оба гнезда пустые — цепь разомкнута.', 'neutral'];
      if (m.ok && m.heat > 0.75) return ['Ток правильный, но балласт раскаляется: он не выдержит и минуты.', 'warn'];
      if (m.ok) return ['Двести двадцать миллиампер, и балласт держит нагрев спокойно.', 'good'];
      if (m.i > 0.24) return ['Тока многовато: общее сопротивление балласта маловато.', 'warn'];
      return ['Тока маловато: общее сопротивление балласта великовато.', 'warn'];
    },

    goal(m) {
      if (m.burnt) return { ok: false, note: 'Балласт выгорел — замени его и раздели мощность.' };
      return { ok: m.ok, note: 'В узле ' + fmtAmps(m.i) + ', нужно 220 мА' };
    },

    score(m) { return m.burnt ? 0 : bandScore(m.i, 0.22, 0.07) * (1 - clamp(m.heat, 0, 1) * 0.25); },
    scoreNote(m) { return 'Ток ' + fmtAmps(m.i) + ' при нагреве балласта ' + Math.round(clamp(m.heat, 0, 1) * 100) + '% — запас есть'; },

    meter(m) {
      return [
        ['Ток узла', fmtAmps(m.i), m.ok ? 'good' : 'warn'],
        ['Греется первое гнездо', fmtWatts(m.p1)],
        ['Греется второе гнездо', fmtWatts(m.p2)],
        ['Нагрев балласта', Math.round(clamp(m.heat, 0, 1) * 100) + '%', m.heat > 0.75 ? 'bad' : ''],
        ['Предел гнезда', '1,5 Вт'],
      ];
    },
  }));
})();
