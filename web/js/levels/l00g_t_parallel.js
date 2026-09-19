'use strict';
// Т-07 · Две ветки рядом. Зеркальная пара к предыдущей сборке: там ток был
// общий и складывались сопротивления, здесь напряжение общее и складываются
// токи. Первая ветка намеренно не трогается вообще — чтобы было видно, что
// возня со второй на неё почти не влияет.

(() => {
  const KIT = [10, 33, 100, 470];
  const L = Rig.rows({
    id: 't_parallel',
    board: DB.m.board,
    supply: { id: 'SUP', name: 'Питание стенда', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.4,
    rows: [
      {
        id: 'A', rated: 0.25,
        items: [{ id: 'HL1', kind: 'lamp', name: 'Лампа первой ветки', silk: 'HL1', value: 68, showValue: true, rated: { pNom: 2.1, pMax: 5.0, tau: 1.2 } }],
      },
      {
        id: 'B', rated: 0.25,
        items: [
          deckSocket('R1', 'Гнездо второй ветки', { silk: 'R1', title: 'Что поставить во вторую ветку', jumper: false, kit: KIT, rated: { pMax: 2.0, tau: 1.0 } }),
          { id: 'HL2', kind: 'lamp', name: 'Лампа второй ветки', silk: 'HL2', value: 68, showValue: true, rated: { pNom: 2.1, pMax: 5.0, tau: 1.2 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 't_parallel',
    index: 7,
    title: 'Две ветки рядом',
    teaches: 'параллельные ветки складывают токи',
    silk: 'STD-007',
    diag: 'СТЕНД · Сборка Т-07: вторая ветка разомкнута.',
    brief: 'Две ветки висят на одной шине. Первая работает и трогать её не надо. Во второй пустое гнездо. Источник должен отдавать в сумме 292 миллиампера — подбирай только вторую ветку и смотри, что при этом делается с первой.',
    lesson: 'Ветки, подключённые к одной шине, получают одинаковое напряжение и берут каждая свой ток; общий ток источника — это их сумма. Друг на друга они почти не влияют: соседняя ветка чувствует только просадку самого источника, а не то, что ты в этой ветке поставил. Отсюда и вся домашняя проводка: каждый прибор включают параллельно, чтобы он не зависел от остальных.',
    reveal: 'Пункт седьмой: «Всё на станции повешено параллельно. Это значит, что отключить можно что угодно, и остальное будет работать. Я этим и пользовался, когда гасил».',
    hints: [
      'Ток первой ветки от твоих действий почти не меняется — смотри на него, чтобы в этом убедиться.',
      'Из нужных 292 миллиампер вычти то, что берёт первая ветка. Остаток — это ток второй.',
      'Поделив двенадцать вольт на этот остаток, получишь сопротивление всей второй ветки. Лампа в ней уже занимает шестьдесят восемь ом.',
    ],
    codex: ['series', 'current', 'ohm', 'circuit', 'lamp'],
    vmax: 12.0,
    hold: 2.0,
    scale: DB.m.scale,
    board: DB.m.board,
    map: { pos: vec(215, -1085), radius: 900, color: hex(0xffc46b), from: ['t_resist', 't_series'], icon: { kind: 'lamp' } },
    goalText: 'Общий ток источника — 292 мА (допуск ±5%).',
    scope: { label: 'Общий ток', get: (m) => m.total, min: 0, max: 0.5, band: [0.2774, 0.3066], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const i1 = Math.abs(sol.componentCurrent.HL1 || 0);
      const i2 = Math.abs(sol.componentCurrent.HL2 || 0);
      return {
        i1, i2, total: i1 + i2,
        vcc: sol.nodeVoltage.VCC || 0,
        empty: !P.R1.content,
        r: P.R1.content ? P.R1.content.value : 0,
        ok: inPct(i1 + i2, 0.292, 0.05),
      };
    },

    status(m) {
      if (m.empty) return ['Вторая ветка разомкнута: ток берёт только первая.', 'neutral'];
      if (m.ok) return ['Двести девяносто два миллиампера в сумме. Первая ветка при этом почти не сдвинулась.', 'good'];
      if (m.total > 0.3066) return ['Общий ток великоват: вторая ветка берёт слишком много.', 'warn'];
      return ['Общий ток маловат: вторая ветка берёт слишком мало.', 'warn'];
    },

    goal(m) {
      return { ok: m.ok, note: 'В сумме ' + fmtAmps(m.total) + ', нужно 292 мА' };
    },

    score(m) { return bandScore(m.total, 0.292, 0.05); },
    scoreNote(m) { return 'Первая ветка ' + fmtAmps(m.i1) + ', вторая ' + fmtAmps(m.i2) + ', вместе ' + fmtAmps(m.total); },

    meter(m) {
      return [
        ['Общий ток', fmtAmps(m.total), m.ok ? 'good' : 'warn'],
        ['Первая ветка', fmtAmps(m.i1)],
        ['Вторая ветка', m.empty ? '—' : fmtAmps(m.i2)],
        ['Напряжение шины', fmtVolts(m.vcc)],
        ['Нужно', '292 мА'],
      ];
    },
  }));
})();
