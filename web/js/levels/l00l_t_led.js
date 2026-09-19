'use strict';
// Т-12 · Светодиод. Тот же диод, только светящийся, — и с одной особенностью,
// из-за которой без резистора он живёт секунды: своё падение он держит почти
// постоянным, а ток берёт какой дадут.

(() => {
  const KIT = [220, 470, 1000];
  const L = Rig.rows({
    id: 't_led',
    board: DB.s.board,
    supply: { id: 'SUP', name: 'Питание стенда', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.05,
    rows: [
      {
        id: 'BR', rated: 0.05,
        items: [
          deckSocket('R1', 'Гнездо ограничителя', { silk: 'R1', title: 'Что ограничит ток', jumper: false, kit: KIT, rated: { pMax: 1.0, tau: 1.0 } }),
          {
            id: 'VD1', kind: 'led', name: 'Сигнальный светодиод', silk: 'VD1',
            color: hex(0xff4a2c), vf: 1.8,
            rated: { pNom: 0.036, pMax: 0.075, iNom: 0.02, tau: 0.45 },
          },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 't_led',
    index: 12,
    title: 'Светодиод и ограничитель',
    teaches: 'светодиоду нужен ограничитель тока',
    silk: 'STD-012',
    diag: 'СТЕНД · Сборка Т-12: гнездо ограничителя пустое.',
    brief: 'Светодиоду нужно двадцать миллиампер — примерно, от пятнадцати до двадцати шести. Шина при этом двенадцативольтовая. В ящике три номинала; перемычки в нём специально нет.',
    lesson: 'Светодиод держит на себе почти постоянное напряжение — около 1,8 вольта, сколько бы ни было на шине. Всё остальное обязан взять на себя резистор, и именно он задаёт ток. Считают так: из напряжения шины вычесть падение светодиода, а остаток разделить на нужный ток — получится номинал ограничителя. Без резистора считать нечему, и ток вырастает до предела, на котором светодиод сгорает.',
    reveal: 'Пункт двенадцатый: «Индикаторы по всей станции сделаны так же: светодиод и резистор рядом. Если увидишь светодиод без резистора — значит, резистор оттуда вынули, а не забыли поставить».',
    hints: [
      'Из двенадцати вольт вычти 1,8 вольта светодиода — остальное достанется резистору.',
      'Раздели этот остаток на нужный ток: 10,2 вольта делить на 0,02 ампера.',
      'Получится около пятисот ом. Ближайший в ящике — 470.',
    ],
    codex: ['led', 'resistor', 'ohm', 'current', 'diode'],
    vmax: 12.0,
    hold: 2.0,
    scale: DB.s.scale,
    board: DB.s.board,
    map: { pos: vec(-215, -920), radius: 900, color: hex(0xff5a33), from: ['t_short', 't_diode'], icon: { kind: 'led', color: hex(0xff4a2c) } },
    goalText: 'Ток светодиода — 15…26 мА.',
    scope: { label: 'Ток светодиода', get: (m) => m.i, min: 0, max: 0.06, band: [0.015, 0.026], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const i = Math.abs(sol.componentCurrent.VD1 || 0);
      return {
        i,
        empty: !P.R1.content,
        r: P.R1.content ? P.R1.content.value : 0,
        uLed: sol.nodeVoltage.BR_1 || 0,
        uRes: (sol.nodeVoltage.VCC || 0) - (sol.nodeVoltage.BR_1 || 0),
        burnt: !!P.VD1.burnt,
        heat: clamp(P.VD1.heat || 0, 0, 1),
        ok: !P.VD1.burnt && i >= 0.015 && i <= 0.026,
      };
    },

    status(m) {
      if (m.burnt) return ['Светодиод сгорел: ток был слишком большой. Замени его и возьми ограничитель побольше.', 'bad'];
      if (m.empty) return ['Гнездо пустое — ветка разомкнута, светодиод не горит.', 'neutral'];
      if (m.i > 0.026) return ['Ток выше нормы: ограничитель слишком мал, светодиод греется.', 'warn'];
      if (m.i < 0.015) return ['Ток ниже нормы: ограничитель слишком велик, светит еле-еле.', 'warn'];
      return ['Горит ровно, ток в норме. Этот номинал и нужен.', 'good'];
    },

    goal(m) {
      if (m.burnt) return { ok: false, note: 'Светодиод сгорел — замени его.' };
      return { ok: m.ok, note: 'Ток ' + fmtAmps(m.i) + ', нужно 15…26 мА' };
    },

    score(m) { return m.burnt ? 0 : clamp(m.i / 0.02, 0, 1); },
    scoreNote(m) { return 'Ограничитель ' + fmtOhms(m.r) + ': на нём ' + fmtVolts(m.uRes) + ', на светодиоде ' + fmtVolts(m.uLed); },

    meter(m) {
      return [
        ['Ток светодиода', fmtAmps(m.i), m.ok ? 'good' : (m.i > 0.026 ? 'bad' : '')],
        ['На светодиоде', m.empty ? '—' : fmtVolts(m.uLed)],
        ['На ограничителе', m.empty ? '—' : fmtVolts(m.uRes)],
        ['Нагрев светодиода', Math.round(m.heat * 100) + '%', m.heat > 0.7 ? 'bad' : ''],
        ['Нужно', '15…26 мА'],
      ];
    },
  }));
})();
