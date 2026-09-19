'use strict';
// Б-10 · Первый узел силовой части. Самое простое, что вообще бывает: одна
// ветка от шины до земли, и в ней надо получить заданный ток. Ничего, кроме
// закона Ома, здесь не нужно — и это осознанно: сектор начинается с того, на
// чём стоит всё остальное.

(() => {
  const L = Rig.rows({
    id: 'b_branch',
    board: DB.s.board,
    supply: { id: 'SUP', name: 'Ввод узла', label: '12 В', silk: 'G1', value: 12 },
    rows: [
      {
        id: 'BR', rated: 0.12,
        items: [
          deckSocket('R1', 'Гнездо балласта', { silk: 'R1', title: 'Что поставить в гнездо', jumper: false }),
          { id: 'HL1', kind: 'lamp', name: 'Сигнальная лампа', silk: 'HL1', value: 68, rated: { pNom: 0.72, pMax: 2.6, tau: 1.0 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'b_branch',
    index: 32,
    title: 'Сигнальная ветка',
    teaches: 'закон Ома в ветке',
    silk: 'BRN-100-18',
    diag: 'ДИАГНОСТИКА · Узел Б-10: тока в ветке нет, гнездо балласта пустое.',
    brief: 'Одна ветка от плюса до обратного провода: гнездо и лампа. Гнездо пустое, поэтому ветка разомкнута. Паспорт узла требует в ней ровно сто миллиампер — ни больше, ни меньше.',
    lesson: 'Ток в ветке задаёт не источник, а сопротивление всей ветки целиком. Двенадцать вольт разделить на сто миллиампер — это сто двадцать ом на всю ветку. Лампа уже занимает шестьдесят восемь; остальное и есть номинал балласта.',
    reveal: 'Индикатор наличия шины. Он горел всё это время, пока в гнезде был балласт. Кто-то вынул балласт — и, судя по записи, сделал это намеренно.',
    hints: [
      'Нажми на гнездо — можно выбрать, что в него вставить.',
      'Сложи сопротивление всей ветки: лампа плюс то, что стоит в гнезде.',
      'Двенадцать вольт делить на 0,1 ампера — сто двадцать ом на всю ветку. Лампа даёт шестьдесят восемь.',
    ],
    codex: ['ohm', 'resistor', 'lamp', 'circuit'],
    vmax: 12.0,
    hold: 2.5,
    scale: DB.s.scale,
    board: DB.s.board,
    map: { pos: vec(-752, -135), radius: 900, color: hex(0x8fd0ff), from: ['pump', 'workbench'], icon: { kind: 'resistor', value: 47 } },
    goalText: 'Ток в ветке — 100 мА (допуск ±10%).',
    scope: { label: 'Ток ветки', get: (m) => m.i, min: 0, max: 0.2, band: [0.09, 0.11], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const i = Math.abs(sol.componentCurrent.HL1 || 0);
      return {
        i,
        uBallast: P.R1.content ? (sol.nodeVoltage.VCC || 0) - (sol.nodeVoltage.BR_1 || 0) : NaN,
        uLamp: (sol.nodeVoltage.BR_1 || 0) - 0,
        empty: !P.R1.content,
        ok: inPct(i, 0.1, 0.10),
      };
    },

    status(m) {
      if (m.empty) return ['Гнездо пустое — ветка разомкнута, тока нет совсем.', 'neutral'];
      if (m.ok) return ['Сто миллиампер. Лампа горит в паспортном режиме.', 'good'];
      if (m.i > 0.11) return ['Ток великоват: балласт слишком маленький, лампа перегружена.', 'warn'];
      return ['Ток маловат: балласт слишком большой, лампа еле тлеет.', 'warn'];
    },

    goal(m) {
      return { ok: m.ok, note: 'В ветке ' + fmtAmps(m.i) + ', нужно 100 мА' };
    },

    score(m) { return bandScore(m.i, 0.1, 0.10); },
    scoreNote(m) { return 'Ток ветки ' + fmtAmps(m.i) + ' — ровно то, что просит паспорт узла'; },

    meter(m) {
      return [
        ['Ток ветки', fmtAmps(m.i), m.ok ? 'good' : 'warn'],
        ['На балласте', fmtVolts(m.uBallast)],
        ['На лампе', fmtVolts(m.uLamp)],
        ['Нужно', '100 мА'],
      ];
    },
  }));
})();
