'use strict';
// Г-02 · Две ветки рядом. Обратная сторона предыдущего узла: там ток шёл
// только при обоих замкнутых, здесь достаточно любой одной ветки. И тут же
// первая настоящая причина, зачем ветки дублируют: не «на всякий случай», а
// чтобы ни одна проводка не несла больше, чем рассчитана.

(() => {
  const L = Rig.rows({
    id: 'g_or',
    board: DB.m.board,
    busX: { CTL: 0.5 },
    supply: { id: 'SUP', name: 'Ввод узла', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.35,
    rows: [
      { id: 'A', rated: 0.2, to: 'CTL', items: [deckSocket('RA', 'Первый ввод', { silk: 'RA', title: 'Первый ввод', jumper: false, rated: { pMax: 2.5, tau: 1.2 } })] },
      { id: 'B', rated: 0.2, to: 'CTL', items: [deckSocket('RB', 'Второй ввод', { silk: 'RB', title: 'Второй ввод', jumper: false, rated: { pMax: 2.5, tau: 1.2 } })] },
      { id: 'LD', rated: 0.35, from: 'CTL', items: [{ id: 'HL1', kind: 'lamp', name: 'Нагрузка узла', silk: 'HL1', value: 30, rated: { pNom: 2.5, pMax: 5.0, tau: 1.0 } }] },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'g_or',
    index: 49,
    title: 'Дублированный ввод',
    teaches: 'параллельные ветки делят ток',
    silk: 'ORD-290-35',
    diag: 'ДИАГНОСТИКА · Узел Г-02: оба ввода сняты, нагрузка обесточена.',
    brief: 'Нагрузке нужно 290 мА. Вводов два, они включены рядом, и проводка каждого рассчитана не больше чем на 180 мА. Оба гнезда пустые.',
    lesson: 'Две ветки рядом — это условие «или»: тока хватит и от одной. Но ток из них не выбирает одну — он идёт по обеим сразу, разделившись обратно пропорционально сопротивлениям. Именно ради этого вводы и дублируют: не «на всякий случай», а чтобы ни одна проводка не несла всё целиком. Один ввод нужного номинала даст тот же общий ток — и сгорит по дороге.',
    reveal: 'Дублированный ввод питания отсека. Оба ввода целы. Сняты они не аварией — их сняли аккуратно, инструментом.',
    hints: [
      'Поставь номинал только в одно гнездо и посмотри, сколько тока пойдёт по этой ветке.',
      'Общий ток делится между ветками обратно пропорционально их сопротивлениям: меньше сопротивление — больше ток.',
      'Нужно 290 мА на двоих и не больше 180 мА в каждой. Проще всего — поровну.',
    ],
    codex: ['current', 'series', 'wire', 'ohm', 'lamp'],
    vmax: 12.0,
    hold: 2.5,
    scale: DB.m.scale,
    board: DB.m.board,
    map: { pos: vec(-537, 250), radius: 900, color: hex(0x8fd0ff), from: ['g_and', 'b_or'], icon: { kind: 'resistor', value: 22 } },
    goalText: 'Нагрузка — 290 мА (±7%), и ни в одном вводе не больше 180 мА.',
    scope: { label: 'Ток нагрузки', get: (m) => m.i, min: 0, max: 0.5, band: [0.2697, 0.3103], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const ia = Math.abs(sol.componentCurrent.RA || 0);
      const ib = Math.abs(sol.componentCurrent.RB || 0);
      const i = Math.abs(sol.componentCurrent.HL1 || 0);
      return {
        ia, ib, i,
        over: Math.max(ia, ib) > 0.18,
        inBand: inPct(i, 0.29, 0.07),
        none: !P.RA.content && !P.RB.content,
        ok: inPct(i, 0.29, 0.07) && Math.max(ia, ib) <= 0.18,
      };
    },

    status(m) {
      if (m.none) return ['Оба гнезда пустые — нагрузка обесточена.', 'neutral'];
      if (m.ok) return ['Двести девяносто миллиампер, и оба ввода несут поровну — в пределах своей проводки.', 'good'];
      if (m.over) return ['Общий ток может и в норме, но один ввод несёт ' + fmtAmps(Math.max(m.ia, m.ib)) + ' — его проводка на столько не рассчитана.', 'bad'];
      if (m.i > 0.31) return ['Тока многовато: общее сопротивление вводов маловато.', 'warn'];
      return ['Тока маловато: общее сопротивление вводов великовато.', 'warn'];
    },

    goal(m) {
      if (m.over) return { ok: false, note: 'Ввод перегружен: ' + fmtAmps(Math.max(m.ia, m.ib)) + ' при пределе 180 мА' };
      return { ok: m.ok, note: 'В нагрузке ' + fmtAmps(m.i) + ', нужно 290 мА' };
    },

    score(m) { return m.over ? 0 : bandScore(m.i, 0.29, 0.07); },
    scoreNote(m) { return 'Нагрузка берёт ' + fmtAmps(m.i) + ', и ни один ввод не несёт больше ' + fmtAmps(Math.max(m.ia, m.ib)); },

    meter(m) {
      return [
        ['Первый ввод', fmtAmps(m.ia), m.ia > 0.18 ? 'bad' : ''],
        ['Второй ввод', fmtAmps(m.ib), m.ib > 0.18 ? 'bad' : ''],
        ['В нагрузке', fmtAmps(m.i), m.inBand ? 'good' : 'warn'],
        ['Предел ввода', '180 мА'],
        ['Нужно', '290 мА'],
      ];
    },
  }));
})();
