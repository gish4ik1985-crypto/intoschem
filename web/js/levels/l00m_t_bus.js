'use strict';
// Т-13 · Общая шина. Повтор параллельного включения, но уже с разными по
// характеру потребителями и с настоящим вопросом «как одна ветка чувствует
// другую». Ответ: только через просадку источника — и это видно на приборах.
//
// Второй из шести отводов, которых нет на схеме (SECRET_TAPS в _deck.js).
// Здесь он заметно больше первого, и это не случайность.

(() => {
  const KIT = [10, 22, 33, 47, 100];
  const L = Rig.rows({
    id: 't_bus',
    board: DB.m.board,
    supply: { id: 'SUP', name: 'Питание стенда', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.4,
    rows: [
      {
        id: 'A', rated: 0.25,
        items: [{ id: 'HL1', kind: 'lamp', name: 'Освещение стенда', silk: 'HL1', value: 68, showValue: true, rated: { pNom: 2.1, pMax: 5.0, tau: 1.2 } }],
      },
      {
        id: 'B', rated: 0.25,
        items: [
          deckSocket('R1', 'Гнездо привода', { silk: 'R1', title: 'Балласт привода', jumper: false, kit: KIT, rated: { pMax: 2.0, tau: 1.0 } }),
          { id: 'M1', kind: 'motor', name: 'Привод стенда', silk: 'M1', value: 47, rated: { iNom: 0.15, pMax: 3.0, tau: 1.5 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 't_bus',
    index: 13,
    title: 'Общая шина',
    teaches: 'соседи по шине связаны только просадкой',
    silk: 'STD-013',
    diag: 'СТЕНД · Сборка Т-13: привод не выведен на паспортный ток.',
    brief: 'На шине висят две разные вещи: освещение и привод. Приводу нужно ровно 150 миллиампер. Освещение трогать нельзя — но следи за ним: интересно, насколько оно вообще заметит твою настройку.',
    lesson: 'Общая шина не значит «общая судьба». Каждая ветка берёт свой ток по своему сопротивлению, и на соседа это влияет только одним способом: чем больше суммарный ток, тем сильнее просаживается сам источник — у него внутри тоже есть сопротивление. Поэтому напряжение шины чуть-чуть уходит вниз при каждом новом потребителе, и вместе с ним чуть-чуть тускнеет всё остальное.',
    reveal: 'Пункт тринадцатый: «Если на шине всё в порядке, а лампа села — ищи не лампу, а того, кто рядом стал брать больше. И сложи токи: они должны сходиться».',
    hints: [
      'Смотри на строку «Напряжение шины», пока подбираешь балласт: она чуть-чуть ходит.',
      'Приводу нужно 150 мА, и сам он даёт 47 ом. Двенадцать вольт делить на 0,15 — это восемьдесят ом на всю ветку.',
      'Восемьдесят минус сорок семь — это то, что должно стоять в гнезде.',
    ],
    codex: ['current', 'ohm', 'battery', 'motor', 'circuit'],
    vmax: 12.0,
    hold: 2.5,
    scale: DB.m.scale,
    board: DB.m.board,
    map: { pos: vec(0, -920), radius: 900, color: hex(0x6ee7a8), from: ['t_divider', 't_led'], icon: { kind: 'motor' } },
    goalText: 'Ток привода — 150 мА (допуск ±8%).',
    scope: { label: 'Ток привода', get: (m) => m.iM, min: 0, max: 0.3, band: [0.138, 0.162], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => { const refs = Rig.build(c, P); addSecretTap(c, 't_bus'); return refs; },
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const iL = Math.abs(sol.componentCurrent.HL1 || 0);
      const iM = Math.abs(sol.componentCurrent.M1 || 0);
      const leak = Math.abs(sol.componentCurrent.TAP || 0);
      return {
        iL, iM, leak,
        total: iL + iM + leak,
        vcc: sol.nodeVoltage.VCC || 0,
        empty: !P.R1.content,
        r: P.R1.content ? P.R1.content.value : 0,
        ok: inPct(iM, 0.15, 0.08),
      };
    },

    status(m) {
      if (m.empty) return ['Гнездо привода пустое — его ветка разомкнута.', 'neutral'];
      if (m.ok) return ['Сто пятьдесят миллиампер. Освещение при этом почти не шелохнулось.', 'good'];
      if (m.iM > 0.162) return ['Привод берёт слишком много: балласт мал. Заодно посмотри, как село напряжение шины.', 'warn'];
      return ['Привод берёт слишком мало: балласт велик.', 'warn'];
    },

    goal(m) {
      return { ok: m.ok, note: 'Привод берёт ' + fmtAmps(m.iM) + ', нужно 150 мА' };
    },

    score(m) { return bandScore(m.iM, 0.15, 0.08); },
    scoreNote(m) { return 'Привод ' + fmtAmps(m.iM) + ', освещение ' + fmtAmps(m.iL) + ', шина держит ' + fmtVolts(m.vcc); },

    meter(m) {
      return [
        ['Ток привода', fmtAmps(m.iM), m.ok ? 'good' : 'warn'],
        ['Ток освещения', fmtAmps(m.iL)],
        ['Отдаёт источник', fmtAmps(m.total)],
        tapRow(m.leak),
        ['Напряжение шины', fmtVolts(m.vcc)],
        ['Нужно', '150 мА'],
      ];
    },
  }));
})();
