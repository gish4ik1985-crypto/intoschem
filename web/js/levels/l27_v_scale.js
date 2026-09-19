'use strict';
// В-02 · Шкала прибора. Прибор рассчитан на три вольта, а мерить надо
// двенадцать. Делитель здесь не «гасит лишнее», а масштабирует: важна не
// разность, а отношение плеч.

(() => {
  const L = Rig.rows({
    id: 'v_scale',
    board: DB.l.board,
    busX: { MEAS: 0.40 },
    supply: { id: 'SUP', name: 'Измеряемая шина', label: '12 В', silk: 'G1', value: 12 },
    rows: [
      {
        id: 'TOP', to: 'MEAS', rated: 0.12,
        items: [deckSocket('R1', 'Верхнее плечо', { silk: 'R1', title: 'Верхнее плечо шкалы', jumper: false, rated: { pMax: 2.0, tau: 1.0 } })],
      },
      {
        id: 'BOT', from: 'MEAS', rated: 0.12,
        items: [deckSocket('R2', 'Нижнее плечо', { silk: 'R2', title: 'Нижнее плечо шкалы', jumper: false, rated: { pMax: 2.0, tau: 1.0 } })],
      },
      {
        id: 'PV', from: 'MEAS', rated: 0.001,
        items: [{ id: 'PV1', kind: 'device', name: 'Вход прибора', silk: 'PV1', value: 100000, rated: { pMax: 1.0, tau: 1.0 } }],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'v_scale',
    index: 41,
    title: 'Шкала прибора',
    teaches: 'делитель как масштаб',
    silk: 'SCL-4X-27',
    diag: 'ДИАГНОСТИКА · Узел В-02: прибор на 3 В подключён к шине на 12 В.',
    brief: 'На входе прибора написано: не выше трёх вольт. Шина, которую он должен показывать, — двенадцать. Оба гнезда делителя пустые. Нужно, чтобы на входе прибора было ровно три вольта, когда на шине двенадцать.',
    lesson: 'Делитель важен не абсолютными номиналами, а их отношением: нижнее плечо к сумме обоих. Чтобы из двенадцати сделать три, на нижнее плечо должна приходиться четверть — значит верхнее втрое больше нижнего. Сто и тридцать три — это как раз три к одному, и такие номиналы в ящике есть, в отличие от ровных тридцати.',
    reveal: 'Входной делитель измерительного прибора. Тот самый, по которому изделие узнавало, сколько у него осталось напряжения. Последняя запись: девять и четыре десятых.',
    hints: [
      'На вход прибора должна приходить четверть шины.',
      'Четверть — значит нижнее плечо составляет четверть от суммы обоих. То есть верхнее втрое больше нижнего.',
      'Ровных тридцати ом в ящике нет, но сто и тридцать три относятся почти точно как три к одному.',
    ],
    codex: ['divider', 'ohm', 'resistor', 'series'],
    vmax: 12.0,
    hold: 2.5,
    scale: DB.l.scale,
    board: DB.l.board,
    map: { pos: vec(108, -300), radius: 900, color: hex(0x8fd0ff), from: ['v_shunt', 'divider'], icon: { kind: 'resistor', value: 100 } },
    goalText: 'На входе прибора — 3,00 В (допуск ±3%).',
    scope: { label: 'На входе прибора', get: (m) => m.u, min: 0, max: 12, band: [2.91, 3.09], fmt: fmtVolts },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const u = sol.nodeVoltage.MEAS || 0;
      const bus = sol.nodeVoltage.VCC || 0;
      return {
        u, bus,
        ratio: bus > 0.01 ? bus / u : NaN,
        i: Math.abs(sol.componentCurrent.R1 || 0),
        empty: !P.R1.content || !P.R2.content,
        over: u > 3.3,
        ok: inPct(u, 3.0, 0.03),
      };
    },

    status(m) {
      if (m.empty) return ['Одно из плеч пустое — на приборе либо ноль, либо вся шина целиком.', 'neutral'];
      if (m.ok) return ['Три вольта на входе прибора. Шкала сходится: показание умножай на четыре.', 'good'];
      if (m.over) return ['На входе прибора больше трёх вольт — для него это перегрузка.', 'bad'];
      return ['На входе меньше трёх вольт: отношение плеч не то, шкала врёт.', 'warn'];
    },

    goal(m) {
      if (m.empty) return { ok: false, note: 'Делитель не собран.' };
      return { ok: m.ok, note: 'На приборе ' + fmtVolts(m.u) + ', нужно 3,00 В' };
    },

    score(m) { return m.empty ? 0 : bandScore(m.u, 3.0, 0.03); },
    scoreNote(m) { return 'Шина делится в отношении ' + trimNum(m.ratio, 2) + ' к одному — это и есть множитель шкалы'; },

    meter(m) {
      return [
        ['На входе прибора', fmtVolts(m.u), m.ok ? 'good' : (m.over ? 'bad' : 'warn')],
        ['На шине', fmtVolts(m.bus)],
        ['Множитель шкалы', isBadNum(m.ratio) ? '—' : trimNum(m.ratio, 2)],
        ['Ток делителя', fmtAmps(m.i)],
        ['Нужно', '3,00 В · множитель 4'],
      ];
    },
  }));
})();
