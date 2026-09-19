'use strict';
// Е-14 · Свет над люком. Три одинаковые лампы подряд — и всё, что нужно
// понять, видно прямо на приборах: напряжение делится между ними поровну,
// потому что они одинаковые, а ток у всех троих один и тот же.

(() => {
  const L = Rig.rows({
    id: 'e_light',
    board: DB.m.board,
    supply: { id: 'SUP', name: 'Ввод узла', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.15,
    rows: [
      {
        id: 'LG', rated: 0.15,
        items: [
          { id: 'HL1', kind: 'lamp', name: 'Лампа 1', silk: 'HL1', value: 30, rated: { pNom: 0.29, pMax: 1.2, tau: 1.2 } },
          { id: 'HL2', kind: 'lamp', name: 'Лампа 2', silk: 'HL2', value: 30, rated: { pNom: 0.29, pMax: 1.2, tau: 1.2 } },
          { id: 'HL3', kind: 'lamp', name: 'Лампа 3', silk: 'HL3', value: 30, rated: { pNom: 0.29, pMax: 1.2, tau: 1.2 } },
          deckSocket('R1', 'Гнездо добавочного', { silk: 'R1', title: 'Что добавить в гирлянду', jumper: false, rated: { pMax: 2.0, tau: 1.0 } }),
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'e_light',
    index: 75,
    title: 'Свет над люком',
    teaches: 'одинаковые подряд делят напряжение поровну',
    silk: 'LGT-030-75',
    diag: 'ДИАГНОСТИКА · Узел Е-14: гирлянда разомкнута, гнездо добавочного пустое.',
    brief: 'Три лампы над люком включены цепочкой, одна за другой. Каждая рассчитана на три вольта, а на шине двенадцать. Четвёртое место в цепочке — гнездо: подбери, что туда поставить, чтобы каждой лампе досталось ровно три вольта.',
    lesson: 'Через все детали одной цепочки идёт один и тот же ток, поэтому напряжение делится между ними ровно в отношении их сопротивлений — а если детали одинаковые, то поровну. Три лампы по три вольта берут на себя девять; оставшиеся три должен взять кто-то четвёртый, иначе лампам достанется по четыре и они не переживут. И обратная сторона той же цепочки: перегори любая из них — разорвётся кольцо, и погаснут все.',
    reveal: 'Гирлянда над переходным люком. Её зажигали, когда кто-то шёл наверх. Последнее включение записано — и оно длилось ровно столько, сколько нужно, чтобы дойти до люка и открыть его.',
    hints: [
      'Сложи сопротивление всей цепочки: три лампы по тридцать ом плюс то, что в гнезде.',
      'Каждой лампе достанется её доля от двенадцати вольт — по её сопротивлению.',
      'Три вольта на лампу — это ток около ста миллиампер. Двенадцать вольт делить на 0,1 — сто двадцать ом на всю цепочку.',
    ],
    codex: ['series', 'divider', 'ohm', 'lamp', 'circuit'],
    vmax: 12.0,
    hold: 2.5,
    scale: DB.m.scale,
    board: DB.m.board,
    map: { pos: vec(215, 960), radius: 900, color: hex(0xffc46b), from: ['e_eff', 'e_reserve'], icon: { kind: 'lamp' } },
    goalText: 'На каждой лампе — 3 В (допуск ±5%).',
    scope: { label: 'Напряжение на лампе', get: (m) => m.uLamp, min: 0, max: 6, band: [2.85, 3.15], fmt: fmtVolts },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const i = Math.abs(sol.componentCurrent.HL1 || 0);
      const vcc = sol.nodeVoltage.VCC || 0;
      const empty = !P.R1.content;
      return {
        i, empty,
        uLamp: empty ? 0 : vcc - (sol.nodeVoltage.LG_1 || 0),
        uAdd: empty ? 0 : (sol.nodeVoltage.LG_3 || 0),
        r: P.R1.content ? P.R1.content.value : 0,
        ok: !empty && inPct(vcc - (sol.nodeVoltage.LG_1 || 0), 3.0, 0.05),
      };
    },

    status(m) {
      if (m.empty) return ['Гнездо пустое — цепочка разорвана, не горит ни одна лампа.', 'neutral'];
      if (m.ok) return ['По три вольта на лампу. Все три горят одинаково.', 'good'];
      if (m.uLamp > 3.15) return ['Лампам достаётся слишком много: добавочный мал, они долго не проживут.', 'warn'];
      return ['Лампам достаётся слишком мало: добавочный велик, светят вполнакала.', 'warn'];
    },

    goal(m) {
      if (m.empty) return { ok: false, note: 'Цепочка разорвана.' };
      return { ok: m.ok, note: 'На лампе ' + fmtVolts(m.uLamp) + ', нужно 3 В' };
    },

    score(m) { return m.empty ? 0 : bandScore(m.uLamp, 3.0, 0.05); },
    scoreNote(m) { return 'Добавочный ' + fmtOhms(m.r) + ': на каждой лампе ' + fmtVolts(m.uLamp) + ' при токе ' + fmtAmps(m.i); },

    meter(m) {
      return [
        ['На каждой лампе', m.empty ? '—' : fmtVolts(m.uLamp), m.ok ? 'good' : 'warn'],
        ['На добавочном', m.empty ? '—' : fmtVolts(m.uAdd)],
        ['Ток цепочки', fmtAmps(m.i)],
        ['В гнезде', m.empty ? 'пусто' : fmtOhms(m.r)],
        ['Нужно', '3,0 В на лампу'],
      ];
    },
  }));
})();
