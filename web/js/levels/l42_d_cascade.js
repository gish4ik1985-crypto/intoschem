'use strict';
// Д-02 · Каскад делителей. Одна цепочка, две ступени, и обе надо получить
// сразу — при том что снизу висит потребитель, который тянет нижнюю ступень
// вниз, а через неё и верхнюю.

(() => {
  const L = Rig.rows({
    id: 'd_cascade',
    board: DB.xl.board,
    busX: { N1: 0.30, N2: 0.60 },
    supply: { id: 'SUP', name: 'Ввод ядра', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.4,
    rows: [
      { id: 'S1', to: 'N1', rated: 0.4, items: [deckSocket('R1', 'Верхняя ступень', { silk: 'R1', title: 'Верхняя ступень', jumper: false, rated: { pMax: 2.0, tau: 1.0 } })] },
      { id: 'S2', from: 'N1', to: 'N2', rated: 0.4, items: [deckSocket('R2', 'Средняя ступень', { silk: 'R2', title: 'Средняя ступень', jumper: false, rated: { pMax: 2.0, tau: 1.0 } })] },
      { id: 'S3', from: 'N2', rated: 0.4, items: [deckSocket('R3', 'Нижняя ступень', { silk: 'R3', title: 'Нижняя ступень', jumper: false, rated: { pMax: 2.0, tau: 1.0 } })] },
      { id: 'LD', from: 'N2', rated: 0.02, items: [{ id: 'LD1', kind: 'device', name: 'Потребитель нижней ступени', silk: 'RL', value: 470, rated: { pMax: 1.5, tau: 1.0 } }] },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'd_cascade',
    index: 56,
    title: 'Каскад ступеней',
    teaches: 'две ступени из одной цепочки',
    silk: 'CSC-084-42',
    diag: 'ДИАГНОСТИКА · Узел Д-02: обе ступени вне допуска, все три гнезда пустые.',
    brief: 'Ядру нужны две ступени напряжения сразу: восемь вольт и четыре. Обе снимаются с одной цепочки из трёх сопротивлений — все три гнезда пустые. На нижней ступени висит потребитель на 470 ом, и он там не для красоты.',
    lesson: 'Ток в цепочке один на всех, поэтому напряжение делится между ступенями в отношении их сопротивлений. Чтобы получить восемь и четыре из двенадцати, ступени должны быть равными: на каждой падает по трети. Потребитель снизу подмешивается к нижней ступени и делает её меньше — поэтому ступени берут заметно меньше него, иначе весь расчёт уезжает.',
    reveal: 'Ступени питания вычислителя. Восемь вольт — логика, четыре — память. Память держала своё содержимое ровно до того момента, как ядро обесточили.',
    hints: [
      'Проверь обе ступени сразу: наведи курсор на каждое гнездо и смотри напряжения между ними.',
      'Ток в цепочке общий. Восемь и четыре из двенадцати — это три равные ступени по четыре вольта.',
      'Потребитель на 470 ом стоит параллельно нижней ступени. Чтобы он её не портил, ступени должны быть много меньше него.',
    ],
    codex: ['divider', 'series', 'ohm', 'resistor', 'current'],
    vmax: 12.0,
    hold: 3.0,
    scale: DB.xl.scale,
    board: DB.xl.board,
    map: { pos: vec(108, 100), radius: 900, color: hex(0x2fd4c8), from: ['d_split', 'v_share'], icon: { kind: 'resistor', value: 22 } },
    goalText: 'Верхняя ступень 8 В, нижняя 4 В (допуск ±5%).',
    scope: { label: 'Нижняя ступень', get: (m) => m.n2, min: 0, max: 12, band: [3.8, 4.2], fmt: fmtVolts },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const built = !!P.R1.content && !!P.R2.content && !!P.R3.content;
      // Пустое гнездо оставляет ступень висеть в воздухе: «напряжение» на
      // ней — утечка решателя, а не показание прибора.
      const n1 = built ? (sol.nodeVoltage.N1 || 0) : NaN;
      const n2 = built ? (sol.nodeVoltage.N2 || 0) : NaN;
      return {
        n1, n2, built,
        i: Math.abs(sol.componentCurrent.R1 || 0),
        iLoad: Math.abs(sol.componentCurrent.LD1 || 0),
        heat: Math.max(P.R1.heat || 0, P.R2.heat || 0, P.R3.heat || 0),
        empty: !P.R1.content || !P.R2.content || !P.R3.content,
        ok1: built && inPct(n1, 8.0, 0.05),
        ok2: built && inPct(n2, 4.0, 0.05),
      };
    },

    status(m) {
      if (m.empty) return ['Цепочка не собрана — хотя бы одно гнездо пустое.', 'neutral'];
      if (m.ok1 && m.ok2) return ['Обе ступени в допуске, и потребитель им не мешает.', 'good'];
      if (m.n2 < 3.8 && m.ok1) return ['Верхняя ступень есть, а нижнюю утянул потребитель: она слишком «слабая» рядом с ним.', 'warn'];
      if (m.n1 > 8.4) return ['Верхняя ступень высоко: на верхнее сопротивление приходится слишком мало.', 'warn'];
      return ['Ступени не сходятся: отношения сопротивлений не те.', 'warn'];
    },

    goal(m) {
      if (m.empty) return { ok: false, note: 'Цепочка не собрана.' };
      return { ok: m.ok1 && m.ok2, note: 'Верхняя ' + fmtVolts(m.n1) + ', нижняя ' + fmtVolts(m.n2) };
    },

    score(m) { return m.built ? (bandScore(m.n1, 8.0, 0.05) + bandScore(m.n2, 4.0, 0.05)) / 2 : 0; },
    scoreNote(m) { return 'Ступени ' + fmtVolts(m.n1) + ' и ' + fmtVolts(m.n2) + ' при токе цепочки ' + fmtAmps(m.i); },

    meter(m) {
      return [
        ['Верхняя ступень → 8 В', fmtVolts(m.n1), m.ok1 ? 'good' : 'warn'],
        ['Нижняя ступень → 4 В', fmtVolts(m.n2), m.ok2 ? 'good' : 'warn'],
        ['Ток цепочки', fmtAmps(m.i)],
        ['Ток потребителя', fmtAmps(m.iLoad)],
        ['Нагрев ступеней', Math.round(clamp(m.heat, 0, 1) * 100) + '%', m.heat > 0.8 ? 'bad' : ''],
      ];
    },
  }));
})();
