'use strict';
// Е-15 · Бюджет тока. Последний узел, который виден на карте, и первый, где
// три ветки надо свести не по отдельности, а вместе — под общий предел.
//
// Шестой и последний из отводов, которых нет на схеме. Он самый крупный, и
// бюджет сходится только если посчитать и его тоже. Собственно, ради этого
// он сюда и поставлен: до сих пор его можно было заметить и пройти мимо.

(() => {
  const L = Rig.rows({
    id: 'e_budget',
    board: DB.xl.board,
    supply: { id: 'SUP', name: 'Ввод узла', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.4,
    rows: [
      {
        id: 'LT', rated: 0.2,
        items: [
          deckSocket('R1', 'Балласт света', { silk: 'R1', title: 'Балласт освещения', jumper: false, rated: { pMax: 2.0, tau: 1.0 } }),
          { id: 'HL1', kind: 'lamp', name: 'Освещение', silk: 'HL1', value: 47, showValue: true, rated: { pNom: 1.0, pMax: 4.0, tau: 1.2 } },
        ],
      },
      {
        id: 'DR', rated: 0.2,
        items: [
          deckSocket('R2', 'Балласт привода', { silk: 'R2', title: 'Балласт привода', jumper: false, rated: { pMax: 2.0, tau: 1.0 } }),
          { id: 'M1', kind: 'motor', name: 'Привод люка', silk: 'M1', value: 68, rated: { iNom: 0.1, pMax: 3.0, tau: 1.5 } },
        ],
      },
      {
        id: 'RX', rated: 0.1,
        items: [
          deckSocket('R3', 'Балласт связи', { silk: 'R3', title: 'Балласт передатчика', jumper: false, rated: { pMax: 1.0, tau: 1.0 } }),
          { id: 'D1', kind: 'device', name: 'Передатчик', silk: 'A1', value: 220, showValue: true, rated: { pMax: 2.0, tau: 1.5 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'e_budget',
    index: 76,
    title: 'Бюджет тока',
    teaches: 'сумма веток против предела ввода',
    silk: 'BGT-380-76',
    diag: 'ДИАГНОСТИКА · Узел Е-15: три ветки узла обесточены, все гнёзда пустые.',
    brief: 'Три ветки на одном вводе: освещение — 150 мА, привод — 100 мА, передатчик — 40 мА. Ввод держит 380 мА в сумме и ни миллиампером больше. Все три гнезда пустые.',
    lesson: 'Каждая ветка настраивается по своему закону Ома, но живут они на одном вводе, и складывается всё, что через него идёт. Поэтому проектируют не «каждую ветку по отдельности», а бюджет: сначала считают, сколько нужно каждому, потом складывают и сверяют с тем, что ввод способен отдать. И считать надо ВСЁ, что висит на этом вводе, — включая то, чего нет ни на одной схеме, но что приборы честно показывают.',
    reveal: 'Сводный ввод точки подъёма. Все три ветки в паспорте есть, а сумма в нём написана с запасом, который никак не сходится с тремя ветками. Разница ровно та, что все эти годы уходила мимо схемы.',
    hints: [
      'Считай ветки по одной: напряжение делить на нужный ток, минус то, что уже стоит в ветке.',
      'Потом сложи три тока и посмотри на строку «Отдаёт ввод» — она больше суммы трёх.',
      'Разница и есть тот самый неучтённый ток. Бюджет в 380 мА сходится только вместе с ним.',
    ],
    codex: ['ohm', 'current', 'power', 'series', 'circuit'],
    vmax: 12.0,
    hold: 3.0,
    scale: DB.xl.scale,
    board: DB.xl.board,
    map: { pos: vec(430, 960), radius: 900, color: hex(0xd0a8ff), from: ['e_line', 'e_light'], icon: { kind: 'device', value: 220 } },
    goalText: 'Свет 150 мА, привод 100 мА, связь 40 мА — и сумма по вводу не выше 380 мА.',
    scope: { label: 'Ток ввода', get: (m) => m.total, min: 0, max: 0.6, band: [0, 0.38], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => { const refs = Rig.build(c, P); addSecretTap(c, 'e_budget'); return refs; },
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const i1 = Math.abs(sol.componentCurrent.HL1 || 0);
      const i2 = Math.abs(sol.componentCurrent.M1 || 0);
      const i3 = Math.abs(sol.componentCurrent.D1 || 0);
      const leak = Math.abs(sol.componentCurrent.TAP || 0);
      const total = i1 + i2 + i3 + leak;
      const ok1 = inPct(i1, 0.15, 0.08);
      const ok2 = inPct(i2, 0.10, 0.08);
      const ok3 = inPct(i3, 0.04, 0.06);
      return {
        i1, i2, i3, leak, total, ok1, ok2, ok3,
        empty: !P.R1.content || !P.R2.content || !P.R3.content,
        ok: ok1 && ok2 && ok3 && total <= 0.38,
      };
    },

    status(m) {
      if (m.empty) return ['Не все ветки собраны — какое-то из гнёзд ещё пустое.', 'neutral'];
      if (m.total > 0.38) return ['Сумма по вводу ' + fmtAmps(m.total) + ' — выше предела. Не забудь, что мимо схемы тоже уходит ток.', 'bad'];
      if (m.ok) return ['Все три ветки в паспорте, и сумма укладывается в бюджет ввода.', 'good'];
      if (!m.ok1) return ['Освещение не в паспорте.', 'warn'];
      if (!m.ok2) return ['Привод не в паспорте.', 'warn'];
      return ['Передатчик не в паспорте.', 'warn'];
    },

    goal(m) {
      if (m.empty) return { ok: false, note: 'Все три гнезда должны быть заняты.' };
      if (m.total > 0.38) return { ok: false, note: 'Ввод отдаёт ' + fmtAmps(m.total) + ', предел 380 мА' };
      return { ok: m.ok, note: 'Свет ' + fmtAmps(m.i1) + ', привод ' + fmtAmps(m.i2) + ', связь ' + fmtAmps(m.i3) };
    },

    score(m) {
      if (!m.ok) return 0;
      return clamp((0.38 - m.total) / 0.05, 0, 1) * 0.3 + 0.7;
    },
    scoreNote(m) { return 'Три ветки в паспорте, ввод отдаёт ' + fmtAmps(m.total) + ' при пределе 380 мА'; },

    meter(m) {
      return [
        ['Отдаёт ввод', fmtAmps(m.total), m.total <= 0.38 ? 'good' : 'bad'],
        ['Освещение', fmtAmps(m.i1), m.ok1 ? 'good' : 'warn'],
        ['Привод', fmtAmps(m.i2), m.ok2 ? 'good' : 'warn'],
        ['Передатчик', fmtAmps(m.i3), m.ok3 ? 'good' : 'warn'],
        tapRow(m.leak),
        ['Предел ввода', '380 мА'],
      ];
    },
  }));
})();
