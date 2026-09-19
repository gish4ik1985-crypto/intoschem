'use strict';
// Д-07 · Ядро. Последний узел платы. Ничего, чего игрок не делал раньше, —
// но впервые всё сразу и на мягком источнике: каждая настроенная ветка
// немного портит две соседние, потому что шина у них одна и она проседает.

(() => {
  const L = Rig.rows({
    id: 'd_core',
    board: DB.l.board,
    supply: { id: 'SUP', name: 'Резерв ядра', label: '12 В', silk: 'G1', value: 12, rInt: SUPPLY_R.KRONA },
    rated: 0.15,
    rows: [
      {
        id: 'LP', rated: 0.1,
        items: [
          deckSocket('RA', 'Балласт индикации', { silk: 'RA', title: 'Балласт индикации', jumper: false, rated: { pMax: 2.0, tau: 1.0 } }),
          { id: 'HL1', kind: 'lamp', name: 'Индикация ядра', silk: 'HL1', value: 30, rated: { pNom: 0.25, pMax: 1.2, tau: 1.0 } },
        ],
      },
      {
        id: 'DV', rated: 0.04,
        items: [
          deckSocket('RB', 'Балласт вычислителя', { silk: 'RB', title: 'Балласт вычислителя', jumper: false, rated: { pMax: 2.0, tau: 1.0 } }),
          { id: 'D2', kind: 'device', name: 'Вычислитель', silk: 'A1', value: 220, rated: { pMax: 2.0, tau: 1.2 } },
        ],
      },
      {
        id: 'LD', rated: 0.03,
        items: [
          deckSocket('RC', 'Балласт маяка', { silk: 'RC', title: 'Балласт маяка', jumper: false, rated: { pMax: 2.0, tau: 1.0 } }),
          { id: 'VD1', kind: 'led', name: 'Маяк ядра', silk: 'VD1', color: hex(0xff4a2c), vf: 1.8, rated: { pNom: 0.038, pMax: 0.075, iNom: 0.021, tau: 0.45 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'd_core',
    index: 61,
    title: 'Ядро',
    teaches: 'три ветки на мягком источнике',
    silk: 'CRE-000-47',
    diag: 'ДИАГНОСТИКА · Узел Д-07: ядро на резервном питании, все три балласта вынуты.',
    brief: 'Последний узел платы. Индикация 246 мВт, вычислитель 157 мВт, маяк 21 мА — и при этом на шине должно остаться не меньше 11,7 вольта. Питание идёт от резерва, а у резерва внутри почти два ома: каждая включённая ветка сажает шину всем остальным.',
    lesson: 'Всё это ты уже делал по отдельности. Разница в том, что источник здесь мягкий: его внутреннее сопротивление заметно, и напряжение на шине зависит от суммарного тока. Значит ветки перестают быть независимыми — настроив одну, ты сдвигаешь две другие. Считать такой узел приходится целиком: сначала прикинуть общий ток, потом просевшую шину, и уже от неё — балласты.',
    reveal: 'Ядро изделия. Это автономный зонд, и он всё ещё считает себя работающим. Последняя запись в его собственном журнале: «связь с поверхностью не восстановлена, наблюдение продолжаю». Дата — раньше всего, что ты читал до сих пор.',
    hints: [
      'Наведи курсор на резерв: разница между паспортными двенадцатью вольтами и тем, что на шине, — это просадка на его внутреннем сопротивлении.',
      'Считай от просевшей шины, а не от двенадцати вольт: разница почти четверть вольта, и на маяке она заметна.',
      'Порядок такой: прикинь суммарный ток (около 140 мА), вычти просадку — останется около 11,77 В. От неё и считай все три ветки.',
    ],
    codex: ['battery', 'power', 'ohm', 'led', 'divider'],
    vmax: 12.0,
    hold: 3.5,
    scale: DB.l.scale,
    board: DB.l.board,
    map: { pos: vec(108, 265), radius: 900, color: hex(0xff5b3d), from: ['d_cascade', 'd_restore'], icon: { kind: 'led' } },
    goalText: 'Индикация 246 мВт, вычислитель 157 мВт, маяк 21 мА, шина не ниже 11,7 В.',
    scope: { label: 'Напряжение шины ядра', get: (m) => m.bus, min: 10.5, max: 12, band: [11.7, 12], fmt: fmtVolts },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const bus = sol.nodeVoltage.VCC || 0;
      const iLamp = Math.abs(sol.componentCurrent.HL1 || 0);
      const iDev = Math.abs(sol.componentCurrent.D2 || 0);
      const iLed = Math.abs(sol.componentCurrent.VD1 || 0);
      return {
        bus, iLamp, iDev, iLed,
        pLamp: iLamp * iLamp * 30,
        pDev: iDev * iDev * 220,
        total: iLamp + iDev + iLed,
        burnt: !!P.VD1.burnt,
        busOk: bus >= 11.7,
        okLamp: inPct(iLamp * iLamp * 30, 0.246, 0.08),
        okDev: inPct(iDev * iDev * 220, 0.157, 0.08),
        okLed: inPct(iLed, 0.021, 0.10),
      };
    },

    status(m) {
      if (m.burnt) return ['Маяк сгорел: балласт слишком мал. Замени его и посчитай от просевшей шины.', 'bad'];
      const n = [m.okLamp, m.okDev, m.okLed].filter(Boolean).length;
      if (n === 3 && m.busOk) return ['Ядро собрано. Все три ветки в паспорте, и шина держится.', 'good'];
      if (!m.busOk) return ['Шина просела до ' + fmtVolts(m.bus) + ': ветки вместе тянут больше, чем резерв может отдать без просадки.', 'warn'];
      if (n === 0) return ['Ядро обесточено. Начинай с любой ветки, но помни: настроив одну, ты сдвинешь остальные.', 'neutral'];
      return ['Готово веток: ' + n + ' из 3. Проверь остальные заново — шина сдвинулась.', 'warn'];
    },

    goal(m) {
      if (m.burnt) return { ok: false, note: 'Маяк сгорел — замени его.' };
      if (!m.busOk) return { ok: false, note: 'Шина ' + fmtVolts(m.bus) + ', нужно не ниже 11,7 В' };
      return {
        ok: m.okLamp && m.okDev && m.okLed,
        note: fmtWatts(m.pLamp) + ' · ' + fmtWatts(m.pDev) + ' · ' + fmtAmps(m.iLed),
      };
    },

    score(m) {
      if (m.burnt || !m.busOk) return 0;
      return (bandScore(m.pLamp, 0.246, 0.08) + bandScore(m.pDev, 0.157, 0.08) + bandScore(m.iLed, 0.021, 0.10)) / 3;
    },
    scoreNote(m) { return 'Ядро берёт ' + fmtAmps(m.total) + ', шина держит ' + fmtVolts(m.bus) + ' из паспортных двенадцати'; },

    meter(m) {
      return [
        ['Индикация → 246 мВт', fmtWatts(m.pLamp), m.okLamp ? 'good' : 'warn'],
        ['Вычислитель → 157 мВт', fmtWatts(m.pDev), m.okDev ? 'good' : 'warn'],
        ['Маяк → 21 мА', fmtAmps(m.iLed), m.okLed ? 'good' : 'warn'],
        ['Шина ядра', fmtVolts(m.bus), m.busOk ? 'good' : 'bad'],
        ['Всего берёт', fmtAmps(m.total)],
      ];
    },
  }));
})();
