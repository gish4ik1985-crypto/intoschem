'use strict';
// Т-14 · Выпускная сборка стенда. Ничего нового не вводит нарочно: всё, что
// здесь нужно, уже было по отдельности — ключ, сумма двух номиналов, ток по
// закону Ома. Это проверка того, что стенд действительно прошли, а не
// прокликали.

(() => {
  const L = Rig.rows({
    id: 't_check',
    board: DB.m.board,
    supply: { id: 'SUP', name: 'Питание стенда', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.3,
    rows: [
      {
        id: 'BR', rated: 0.3,
        items: [
          deckToggle('SA1', 'Ключ стенда', false, 'Нажми, чтобы замкнуть или разомкнуть'),
          deckSocket('R1', 'Первое гнездо', { silk: 'R1', title: 'Первое гнездо', jumper: true, rated: { pMax: 2.0, tau: 1.0 } }),
          deckSocket('R2', 'Второе гнездо', { silk: 'R2', title: 'Второе гнездо', jumper: true, rated: { pMax: 2.0, tau: 1.0 } }),
          { id: 'HL1', kind: 'lamp', name: 'Контрольная лампа', silk: 'HL1', value: 22, showValue: true, rated: { pNom: 0.32, pMax: 4.0, tau: 1.2 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 't_check',
    index: 14,
    title: 'Проверка стенда',
    teaches: 'всё вместе: ключ, сумма, закон Ома',
    silk: 'STD-014',
    diag: 'СТЕНД · Сборка Т-14: ключ разомкнут, в первом гнезде перемычка.',
    brief: 'Последняя сборка стенда. Нужно 120 миллиампер. Ключ разомкнут, в первом гнезде оставлена перемычка, второе пустое. Дальше начинается чужая плата, и подсказок там будет меньше.',
    lesson: 'Ничего нового: замкнуть кольцо, сложить два номинала, поделить напряжение на нужный ток. Дальше эти же три действия повторяются на всей плате, только вместо контрольной лампы будут настоящие узлы, а вместо «нужно 120 миллиампер» — их паспорт. Стенд на этом закончен: руки целы, приборы врать не начали.',
    reveal: 'Пункт четырнадцатый, последний: «Дальше по коридору — сама станция. Всё выключено в том порядке, в каком написано в этом списке. Включай в обратном. И ещё: у меня всё время не сходились токи, где-то на плате что-то ест понемногу. Найди это. Я не успел».',
    hints: [
      'Сначала замкни ключ — иначе приборы ничего не покажут.',
      'Перемычка в гнезде — это ноль ом: она не мешает току, но и не помогает.',
      'Двенадцать вольт делить на 0,12 ампера — это сто ом на всю ветку. Лампа даёт двадцать два, остальные семьдесят восемь надо набрать двумя гнёздами.',
    ],
    codex: ['ohm', 'series', 'switch', 'resistor', 'circuit'],
    vmax: 12.0,
    hold: 2.5,
    scale: DB.m.scale,
    board: DB.m.board,
    map: { pos: vec(215, -920), radius: 900, color: hex(0x8fd0ff), from: ['t_parallel', 't_bus'], icon: { kind: 'resistor', value: 68 } },
    goalText: 'Замкни ключ и получи 120 мА (допуск ±6%).',
    scope: { label: 'Ток в ветке', get: (m) => m.i, min: 0, max: 0.35, band: [0.1128, 0.1272], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const i = Math.abs(sol.componentCurrent.HL1 || 0);
      const val = (s) => (s.content ? (s.content.kind === 'jumper' ? 0 : s.content.value) : null);
      const r1 = val(P.R1), r2 = val(P.R2);
      return {
        i, r1, r2,
        on: !!P.SA1.closed,
        empty: !P.R1.content || !P.R2.content,
        sum: (r1 || 0) + (r2 || 0),
        uLamp: sol.nodeVoltage.BR_3 || 0,
        ok: !!P.SA1.closed && !!P.R1.content && !!P.R2.content && inPct(i, 0.12, 0.06),
      };
    },

    status(m) {
      if (!m.on) return ['Ключ разомкнут — кольца нет.', 'neutral'];
      if (m.empty) return ['Одно из гнёзд пустое: кольцо всё равно разорвано.', 'neutral'];
      if (m.ok) return ['Сто двадцать миллиампер. Стенд проверен целиком.', 'good'];
      if (m.i > 0.1272) return ['Тока многовато: сумма двух гнёзд маловата.', 'warn'];
      return ['Тока маловато: сумма двух гнёзд великовата.', 'warn'];
    },

    goal(m) {
      if (!m.on) return { ok: false, note: 'Ключ разомкнут.' };
      if (m.empty) return { ok: false, note: 'Оба гнезда должны быть заняты.' };
      return { ok: m.ok, note: 'В ветке ' + fmtAmps(m.i) + ', нужно 120 мА' };
    },

    score(m) { return m.ok || (m.on && !m.empty) ? bandScore(m.i, 0.12, 0.06) : 0; },
    scoreNote(m) { return 'Гнёзда дают вместе ' + fmtOhms(m.sum) + ', ток ' + fmtAmps(m.i); },

    meter(m) {
      return [
        ['Ток в ветке', fmtAmps(m.i), m.ok ? 'good' : 'warn'],
        ['Ключ', m.on ? 'замкнут' : 'разомкнут', m.on ? 'good' : 'warn'],
        ['Сумма гнёзд', m.empty ? '—' : fmtOhms(m.sum)],
        ['На лампе', m.empty || !m.on ? '—' : fmtVolts(m.uLamp)],
        ['Нужно', '120 мА'],
      ];
    },
  }));
})();
