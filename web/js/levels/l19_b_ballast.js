'use strict';
// Б-11 · Гасящий резистор. Лампа рассчитана на половину шины, а шина одна.
// Урок ровно один: последовательный резистор забирает на себя ту часть
// напряжения, которая детали не нужна, — и превращает её в тепло.

(() => {
  const L = Rig.rows({
    id: 'b_ballast',
    board: DB.s.board,
    supply: { id: 'SUP', name: 'Ввод узла', label: '12 В', silk: 'G1', value: 12 },
    rows: [
      {
        id: 'BAL', rated: 0.3,
        items: [
          deckSocket('R1', 'Гнездо гасящего', { silk: 'R1', title: 'Чем гасить лишнее', jumper: true, rated: { pMax: 3.0, tau: 1.0 } }),
          { id: 'HL1', kind: 'lamp', name: 'Лампа 6 В', silk: 'HL1', value: 24, rated: { pNom: 1.5, pMax: 3.2, tau: 1.2 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'b_ballast',
    index: 33,
    title: 'Гасящий резистор',
    teaches: 'напряжение делится, мощность греет',
    silk: 'BAL-06-19',
    diag: 'ДИАГНОСТИКА · Узел Б-11: лампа рассчитана на 6 В, шина даёт 12 В.',
    brief: 'На клейме лампы написано шесть вольт. Шина в этом узле одна, и на ней двенадцать. Гнездо перед лампой пустое — значит, тот, кто ставил лампу, что-то из него вынул.',
    lesson: 'Последовательный резистор и лампа делят напряжение шины между собой: ток у них общий, а вольты — пополам, если сопротивления равны. Разницу резистор превращает в тепло, и это не потеря по недосмотру, а его работа. Перемычка вместо него не гасит ничего — лампа получает все двенадцать вольт и живёт секунду.',
    reveal: 'Лампа местного освещения отсека. Шестивольтовая — такие ставят там, где человек работает руками и может лампу задеть.',
    hints: [
      'Наведи курсор на лампу: видно, сколько вольт на ней прямо сейчас.',
      'Лампа и резистор в одной ветке — ток у них общий, а напряжение делится в отношении сопротивлений.',
      'Лампе нужна половина шины. Значит, резистор должен быть примерно равен сопротивлению самой лампы.',
    ],
    codex: ['ohm', 'power', 'series', 'resistor', 'lamp'],
    vmax: 12.0,
    hold: 2.5,
    scale: DB.s.scale,
    board: DB.s.board,
    map: { pos: vec(-537, -135), radius: 900, color: hex(0xffc46b), from: ['flash', 'b_branch'], icon: { kind: 'lamp' } },
    goalText: 'На лампе должно быть 6 В (допуск ±8%).',
    scope: { label: 'Напряжение на лампе', get: (m) => m.uLamp, min: 0, max: 12, band: [5.52, 6.48], fmt: fmtVolts },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const uLamp = sol.nodeVoltage.BAL_1 || 0;
      const i = Math.abs(sol.componentCurrent.HL1 || 0);
      return {
        uLamp, i,
        pLamp: uLamp * i,
        uBallast: P.R1.content ? (sol.nodeVoltage.VCC || 0) - uLamp : NaN,
        pBallast: P.R1.content ? Math.abs(((sol.nodeVoltage.VCC || 0) - uLamp) * i) : NaN,
        empty: !P.R1.content,
        burnt: !!P.HL1.burnt,
        ok: inPct(uLamp, 6.0, 0.08),
      };
    },

    status(m) {
      if (m.burnt) return ['Лампа сгорела: на ней было слишком много вольт. Замени её и поставь в гнездо резистор, а не перемычку.', 'bad'];
      if (m.empty) return ['Гнездо пустое — цепь разомкнута, лампа не горит совсем.', 'neutral'];
      if (m.ok) return ['Шесть вольт на лампе. Ровно то, что написано на её клейме.', 'good'];
      if (m.uLamp > 6.5) return ['На лампе больше шести вольт: гасящий слишком маленький, лампа перегружена.', 'warn'];
      return ['На лампе меньше шести вольт: гасящий слишком большой, лампа недосвечивает.', 'warn'];
    },

    goal(m) {
      if (m.burnt) return { ok: false, note: 'Лампа сгорела — сначала замени её.' };
      return { ok: m.ok, note: 'На лампе ' + fmtVolts(m.uLamp) + ', нужно 6 В' };
    },

    score(m) { return m.burnt ? 0 : bandScore(m.uLamp, 6.0, 0.08); },
    scoreNote(m) { return 'На лампе ' + fmtVolts(m.uLamp) + ', и столько же гасящий забрал на себя — ' + fmtWatts(m.pBallast) + ' уходит в тепло'; },

    meter(m) {
      return [
        ['На лампе', fmtVolts(m.uLamp), m.ok ? 'good' : 'warn'],
        ['На гасящем', fmtVolts(m.uBallast)],
        ['Ток ветки', fmtAmps(m.i)],
        ['Греется гасящий', fmtWatts(m.pBallast)],
        ['Мощность лампы', fmtWatts(m.pLamp)],
      ];
    },
  }));
})();
