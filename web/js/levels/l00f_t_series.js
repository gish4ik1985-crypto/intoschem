'use strict';
// Т-06 · Два гнезда подряд. Правило одно и простое — сопротивления в одной
// ветке складываются, — но именно из него потом растёт всё: и делитель, и
// разложение мощности на две детали, и понимание, почему лампа в ветке тоже
// «резистор».

(() => {
  const L = Rig.rows({
    id: 't_series',
    board: DB.m.board,
    supply: { id: 'SUP', name: 'Питание стенда', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.35,
    rows: [
      {
        id: 'BR', rated: 0.35,
        items: [
          deckSocket('R1', 'Первое гнездо', { silk: 'R1', title: 'Первое гнездо', jumper: false, rated: { pMax: 2.0, tau: 1.0 } }),
          deckSocket('R2', 'Второе гнездо', { silk: 'R2', title: 'Второе гнездо', jumper: false, rated: { pMax: 2.0, tau: 1.0 } }),
          { id: 'HL1', kind: 'lamp', name: 'Контрольная лампа', silk: 'HL1', value: 22, showValue: true, rated: { pNom: 0.25, pMax: 4.0, tau: 1.2 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 't_series',
    index: 6,
    title: 'Два подряд',
    teaches: 'в одной ветке сопротивления складываются',
    silk: 'STD-006',
    diag: 'СТЕНД · Сборка Т-06: оба гнезда пустые.',
    brief: 'Гнёзд теперь два, и стоят они друг за другом. Нужно сто миллиампер. Ровно такого номинала в ящике нет — набери нужное сопротивление двумя резисторами.',
    lesson: 'Детали, стоящие друг за другом в одной ветке, делят между собой напряжение, но ток через них идёт ОДИН И ТОТ ЖЕ — деваться ему некуда, ветка одна. Поэтому их сопротивления просто складываются, как отрезки одной дороги. Важна сумма, а какими именно двумя номиналами ты её набрал — ветке всё равно.',
    reveal: 'Пункт шестой: «Двух одинаковых деталей в ящике почти всегда хватает там, где нет одной правильной. Я так и собирал весь щиток. Не ищи красоту, ищи сумму».',
    hints: [
      'Посчитай, сколько ом нужно на всю ветку: двенадцать вольт делить на 0,1 ампера.',
      'Вычти двадцать два ома лампы — останется то, что надо набрать двумя гнёздами.',
      'Нужно около девяноста восьми ом на два гнезда. Подойдёт, например, сорок семь и сорок семь.',
    ],
    codex: ['series', 'resistor', 'ohm', 'current'],
    vmax: 12.0,
    hold: 2.0,
    scale: DB.m.scale,
    board: DB.m.board,
    map: { pos: vec(430, -1085), radius: 900, color: hex(0x6ee7a8), from: ['t_ohm', 't_resist'], icon: { kind: 'resistor', value: 47 } },
    goalText: 'Ток в ветке — 100 мА (допуск ±6%).',
    scope: { label: 'Ток в ветке', get: (m) => m.i, min: 0, max: 0.3, band: [0.094, 0.106], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const i = Math.abs(sol.componentCurrent.HL1 || 0);
      const r1 = P.R1.content ? P.R1.content.value : 0;
      const r2 = P.R2.content ? P.R2.content.value : 0;
      return {
        i, r1, r2, sum: r1 + r2,
        empty: !P.R1.content || !P.R2.content,
        u1: (sol.nodeVoltage.VCC || 0) - (sol.nodeVoltage.BR_1 || 0),
        u2: (sol.nodeVoltage.BR_1 || 0) - (sol.nodeVoltage.BR_2 || 0),
        uLamp: sol.nodeVoltage.BR_2 || 0,
        ok: inPct(i, 0.1, 0.06),
      };
    },

    status(m) {
      if (m.empty) return ['Хотя бы одно гнездо пустое — ветка разомкнута, тока нет.', 'neutral'];
      if (m.ok) return ['Сто миллиампер. Сумма двух номиналов подобрана верно.', 'good'];
      if (m.i > 0.106) return ['Тока многовато: сумма двух гнёзд маловата.', 'warn'];
      return ['Тока маловато: сумма двух гнёзд великовата.', 'warn'];
    },

    goal(m) {
      if (m.empty) return { ok: false, note: 'Оба гнезда должны быть заняты.' };
      return { ok: m.ok, note: 'В ветке ' + fmtAmps(m.i) + ', нужно 100 мА' };
    },

    score(m) { return m.empty ? 0 : bandScore(m.i, 0.1, 0.06); },
    scoreNote(m) { return fmtOhms(m.r1) + ' и ' + fmtOhms(m.r2) + ' — вместе ' + fmtOhms(m.sum) + ', ток ' + fmtAmps(m.i); },

    meter(m) {
      return [
        ['Ток в ветке', fmtAmps(m.i), m.ok ? 'good' : 'warn'],
        ['Сумма гнёзд', m.empty ? '—' : fmtOhms(m.sum)],
        ['На первом', m.empty ? '—' : fmtVolts(m.u1)],
        ['На втором', m.empty ? '—' : fmtVolts(m.u2)],
        ['На лампе', m.empty ? '—' : fmtVolts(m.uLamp)],
        ['Нужно', '100 мА'],
      ];
    },
  }));
})();
