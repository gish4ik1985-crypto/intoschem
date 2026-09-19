'use strict';
// Е-01 · Приёмный тракт. Первый узел, где счёт идёт на килоомы и миллиамперы:
// до сих пор всё, что чинилось, ело сотнями миллиампер, а этот берёт меньше
// трёх — и именно поэтому на его фоне видно то, что видеть не полагалось.
//
// Третий из шести отводов, которых нет на схеме (SECRET_TAPS в _deck.js).
// Здесь он впервые БОЛЬШЕ, чем весь узел целиком.

(() => {
  const L = Rig.rows({
    id: 'e_listen',
    board: DB.s.board,
    supply: { id: 'SUP', name: 'Ввод узла', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.05,
    rows: [
      {
        id: 'RX', rated: 0.05,
        items: [
          deckSocket('R1', 'Гнездо гасящего', { silk: 'R1', title: 'Что поставить в гнездо', jumper: false, rated: { pMax: 0.5, tau: 1.0 } }),
          { id: 'D1', kind: 'device', name: 'Приёмник', silk: 'A1', value: 2200, rated: { pMax: 0.5, tau: 1.5 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'e_listen',
    index: 62,
    title: 'Приёмный тракт',
    teaches: 'килоомы и миллиамперы',
    silk: 'RCV-027-62',
    diag: 'ДИАГНОСТИКА · Узел Е-01: гнездо гасящего пустое, приёмник обесточен.',
    brief: 'Паспорт приёмника: ток питания 2,7 миллиампера. Не двести семьдесят — два и семь десятых. Собственное сопротивление приёмника 2,2 килоома, гнездо гасящего пустое.',
    lesson: 'Закон Ома не меняется от того, что числа стали мелкими: двенадцать вольт делить на 0,0027 ампера — это примерно четыре с половиной килоома на всю ветку. Просто у слаботочных узлов и номиналы соответствующие: там, где силовая часть считает десятками ом, приёмный тракт считает тысячами. Заодно это значит, что любая посторонняя утечка на его фоне выглядит не мелочью, а вторым потребителем.',
    reveal: 'Приёмный тракт дальней связи. В памяти одна запись, свежее всех остальных на плате: сигнал принят. Не передан — принят. Значит, наверху кто-то есть.',
    hints: [
      'Считай так же, как раньше, просто числа мельче: 12 вольт делить на 0,0027 ампера.',
      'Получится около 4,4 килоома на всю ветку. Приёмник уже занимает 2,2.',
      'Обрати внимание на строку «Ток мимо схемы»: здесь мимо уходит больше, чем берёт сам приёмник.',
    ],
    codex: ['ohm', 'resistor', 'current', 'series'],
    vmax: 12.0,
    hold: 2.5,
    scale: DB.s.scale,
    board: DB.s.board,
    map: { pos: vec(-430, 630), radius: 900, color: hex(0x8fd0ff), from: 'g_soft', icon: { kind: 'resistor', value: 2200 } },
    goalText: 'Ток приёмника — 2,7 мА (допуск ±8%).',
    scope: { label: 'Ток приёмника', get: (m) => m.i, min: 0, max: 0.01, band: [0.00248, 0.00292], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => { const refs = Rig.build(c, P); addSecretTap(c, 'e_listen'); return refs; },
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const i = Math.abs(sol.componentCurrent.D1 || 0);
      const leak = Math.abs(sol.componentCurrent.TAP || 0);
      return {
        i, leak,
        empty: !P.R1.content,
        r: P.R1.content ? P.R1.content.value : 0,
        uDev: sol.nodeVoltage.RX_1 || 0,
        uRes: (sol.nodeVoltage.VCC || 0) - (sol.nodeVoltage.RX_1 || 0),
        ok: inPct(i, 0.0027, 0.08),
      };
    },

    status(m) {
      if (m.empty) return ['Гнездо пустое — приёмник обесточен.', 'neutral'];
      if (m.ok) return ['Два и семь миллиампера. Приёмник в паспортном режиме — и берёт вчетверо меньше, чем уходит мимо схемы.', 'good'];
      if (m.i > 0.00292) return ['Тока многовато: гасящий слишком мал.', 'warn'];
      return ['Тока маловато: гасящий слишком велик.', 'warn'];
    },

    goal(m) {
      return { ok: m.ok, note: 'Приёмник берёт ' + fmtAmps(m.i) + ', нужно 2,7 мА' };
    },

    score(m) { return bandScore(m.i, 0.0027, 0.08); },
    scoreNote(m) { return 'В гнезде ' + fmtOhms(m.r) + ', ток ' + fmtAmps(m.i) + ' при неучтённых ' + fmtAmps(m.leak); },

    meter(m) {
      return [
        ['Ток приёмника', fmtAmps(m.i), m.ok ? 'good' : 'warn'],
        tapRow(m.leak),
        ['На приёмнике', m.empty ? '—' : fmtVolts(m.uDev)],
        ['На гасящем', m.empty ? '—' : fmtVolts(m.uRes)],
        ['Нужно', '2,7 мА'],
      ];
    },
  }));
})();
