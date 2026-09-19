'use strict';
// Т-05 · Первый счёт. Всё, что нужно, уже видно на приборах: напряжение
// известно, нужный ток задан, сопротивление лампы написано на ней. Отсюда и
// дальше игрок считает, а не перебирает.
//
// Здесь же первый из шести отводов, которых нет ни на одной схеме
// (см. SECRET_TAPS в _deck.js): из шины уходит на два с половиной миллиампера
// больше, чем берёт ветка. Сборка от этого не ломается и решается ровно так
// же — просто в приборах появляется строка, которую нечем объяснить.

(() => {
  const L = Rig.rows({
    id: 't_ohm',
    board: DB.s.board,
    supply: { id: 'SUP', name: 'Питание стенда', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.4,
    rows: [
      {
        id: 'BR', rated: 0.4,
        items: [
          deckSocket('R1', 'Гнездо балласта', {
            silk: 'R1', title: 'Что поставить в гнездо', jumper: false,
            rated: { pMax: 2.5, tau: 1.0 },
          }),
          { id: 'HL1', kind: 'lamp', name: 'Контрольная лампа', silk: 'HL1', value: 22, showValue: true, rated: { pNom: 1.0, pMax: 5.0, tau: 1.2 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 't_ohm',
    index: 5,
    title: 'Закон Ома',
    teaches: 'ток = напряжение делить на сопротивление',
    silk: 'STD-005',
    diag: 'СТЕНД · Сборка Т-05: гнездо балласта пустое.',
    brief: 'Двенадцать вольт, лампа на двадцать два ома, нужно ровно двести миллиампер. Теперь ящик полный, и перебирать его целиком долго: посчитай, какой номинал нужен, и поставь сразу его.',
    lesson: 'Три величины связаны одним равенством: ток равен напряжению, делённому на сопротивление. Двенадцать вольт делить на 0,2 ампера — это шестьдесят ом на всю ветку целиком, вместе с лампой. Лампа уже занимает двадцать два; остальное и есть номинал балласта, а в ящике берут ближайший — точного там не бывает почти никогда.',
    reveal: 'Пункт пятый: «Считай, а не подбирай. У тебя не так много времени, как кажется». Ниже, другим нажимом, приписано: «И проверь, сходятся ли токи. У меня не сходились».',
    hints: [
      'Сначала посчитай сопротивление ВСЕЙ ветки: двенадцать вольт делить на нужный ток.',
      'Из этого числа вычти двадцать два ома лампы — останется то, что нужно от балласта.',
      'Получится около тридцати восьми ом. Точно такого в ящике нет, ближайший подходящий — тридцать три.',
    ],
    codex: ['ohm', 'resistor', 'current', 'series', 'lamp'],
    vmax: 12.0,
    hold: 2.0,
    scale: DB.s.scale,
    board: DB.s.board,
    map: { pos: vec(430, -1250), radius: 900, color: hex(0x8fd0ff), from: 't_resist', icon: { kind: 'resistor', value: 33 } },
    goalText: 'Ток в ветке — 200 мА (допуск ±12%).',
    scope: { label: 'Ток в ветке', get: (m) => m.i, min: 0, max: 0.45, band: [0.176, 0.224], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    // Кроме самой ветки к шине припаян отвод, которого нет на схеме сборки.
    build: (c, P) => { const refs = Rig.build(c, P); addSecretTap(c, 't_ohm'); return refs; },
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const i = Math.abs(sol.componentCurrent.HL1 || 0);
      const leak = Math.abs(sol.componentCurrent.TAP || 0);
      return {
        i, leak,
        total: i + leak,
        empty: !P.R1.content,
        r: P.R1.content ? P.R1.content.value : 0,
        uRes: (sol.nodeVoltage.VCC || 0) - (sol.nodeVoltage.BR_1 || 0),
        uLamp: sol.nodeVoltage.BR_1 || 0,
        ok: inPct(i, 0.2, 0.12),
      };
    },

    status(m) {
      if (m.empty) return ['Гнездо пустое — ветка разомкнута.', 'neutral'];
      if (m.ok) return ['Двести миллиампер. Посчитано верно.', 'good'];
      if (m.i > 0.224) return ['Тока многовато: балласт получился слишком маленьким.', 'warn'];
      return ['Тока маловато: балласт получился слишком большим.', 'warn'];
    },

    goal(m) {
      return { ok: m.ok, note: 'В ветке ' + fmtAmps(m.i) + ', нужно 200 мА' };
    },

    score(m) { return bandScore(m.i, 0.2, 0.12); },
    scoreNote(m) { return 'В гнезде ' + fmtOhms(m.r) + ', ток ' + fmtAmps(m.i) + ' при расчётных 200 мА'; },

    meter(m) {
      return [
        ['Ток в ветке', fmtAmps(m.i), m.ok ? 'good' : 'warn'],
        ['Отдаёт источник', fmtAmps(m.total)],
        tapRow(m.leak),
        ['На балласте', m.empty ? '—' : fmtVolts(m.uRes)],
        ['На лампе', m.empty ? '—' : fmtVolts(m.uLamp)],
        ['Нужно', '200 мА'],
      ];
    },
  }));
})();
