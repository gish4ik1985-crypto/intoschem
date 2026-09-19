'use strict';
// Е-11 · Зарядка резерва. Первый узел, где в одной ветке ДВА источника, и
// главное открытие простое: ток задаёт не напряжение шины, а разность между
// шиной и тем, что заряжают. Двенадцать вольт тут ни при чём — работают три.
//
// Пятый из шести отводов, которых нет на схеме.

(() => {
  const L = Rig.rows({
    id: 'e_charge',
    board: DB.m.board,
    supply: { id: 'SUP', name: 'Шина зарядки', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.15,
    rows: [
      {
        id: 'CH', rated: 0.15,
        items: [
          deckSocket('R1', 'Гнездо зарядного', { silk: 'R1', title: 'Через что заряжать', jumper: false, rated: { pMax: 2.0, tau: 1.0 } }),
          {
            id: 'B2', kind: 'cell', name: 'Резервный элемент', label: '9 В', silk: 'GB2',
            value: 9, rInt: SUPPLY_R.AA_CELL,
          },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'e_charge',
    index: 72,
    title: 'Зарядка резерва',
    teaches: 'ток заряда задаёт разность напряжений',
    silk: 'CHG-063-72',
    diag: 'ДИАГНОСТИКА · Узел Е-11: резервный элемент не заряжается, гнездо пустое.',
    brief: 'Резервный элемент на девять вольт заряжают от двенадцативольтовой шины. Паспорт элемента: ток заряда 63 миллиампера, больше нельзя — перегреется. Гнездо зарядного пустое.',
    lesson: 'В ветке два источника, включённых навстречу друг другу: шина толкает ток в одну сторону, элемент — в другую. Ток идёт по разности: двенадцать минус девять, то есть три вольта, и именно эти три вольта делятся на сопротивление зарядного. Считать по двенадцати здесь — самая частая ошибка, и она даёт номинал вчетверо больше нужного. По мере заряда элемент подрастает в напряжении, разность уменьшается, и ток сам собой падает — поэтому такая зарядка и безопасна.',
    reveal: 'Зарядный тракт аварийного резерва. Элемент подключён, но зарядное из гнезда вынуто — и по счётчику видно, что вынули его в тот же день, что и всё остальное.',
    hints: [
      'Посмотри, какое напряжение стоит на самом элементе, и вычти его из напряжения шины.',
      'Ток задаёт именно эта разность, а не полные двенадцать вольт.',
      'Три вольта делить на 0,063 ампера — это около сорока восьми ом.',
    ],
    codex: ['battery', 'ohm', 'current', 'series', 'resistor'],
    vmax: 12.0,
    hold: 2.5,
    scale: DB.m.scale,
    board: DB.m.board,
    map: { pos: vec(-430, 960), radius: 900, color: hex(0x6ee7a8), from: ['e_buffer', 'e_leak'], icon: { kind: 'cell' } },
    goalText: 'Ток заряда — 63 мА (допуск ±10%).',
    scope: { label: 'Ток заряда', get: (m) => m.i, min: 0, max: 0.2, band: [0.0567, 0.0693], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => { const refs = Rig.build(c, P); addSecretTap(c, 'e_charge'); return refs; },
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const i = Math.abs(sol.componentCurrent.R1 || 0);
      const leak = Math.abs(sol.componentCurrent.TAP || 0);
      const uCell = sol.nodeVoltage.CH_1 || 0;
      const vcc = sol.nodeVoltage.VCC || 0;
      return {
        i, leak, uCell, vcc,
        diff: vcc - uCell,
        empty: !P.R1.content,
        r: P.R1.content ? P.R1.content.value : 0,
        ok: inPct(i, 0.063, 0.10),
      };
    },

    status(m) {
      if (m.empty) return ['Гнездо пустое — зарядка не идёт совсем.', 'neutral'];
      if (m.ok) return ['Шестьдесят три миллиампера. Элемент заряжается в паспортном режиме.', 'good'];
      if (m.i > 0.0693) return ['Ток заряда великоват — элемент перегреется. Зарядное слишком мало.', 'warn'];
      return ['Ток заряда маловат: зарядное слишком велико.', 'warn'];
    },

    goal(m) {
      return { ok: m.ok, note: 'Ток заряда ' + fmtAmps(m.i) + ', нужно 63 мА' };
    },

    score(m) { return bandScore(m.i, 0.063, 0.10); },
    scoreNote(m) { return 'Разность ' + fmtVolts(m.diff) + ' на ' + fmtOhms(m.r) + ' даёт ' + fmtAmps(m.i); },

    meter(m) {
      return [
        ['Ток заряда', fmtAmps(m.i), m.ok ? 'good' : 'warn'],
        ['На элементе', fmtVolts(m.uCell)],
        ['Разность с шиной', fmtVolts(m.diff)],
        tapRow(m.leak),
        ['Нужно', '63 мА'],
      ];
    },
  }));
})();
