'use strict';
// Д-06 · Сводный узел. Ничего нового по физике — всё, что здесь есть, уже
// было по отдельности. Новое одно: три условия держатся одновременно, и
// поправить одно, сломав другое, не считается.

(() => {
  const L = Rig.rows({
    id: 'd_restore',
    board: DB.xl.board,
    busX: { BUS: 0.28 },
    supply: { id: 'SUP', name: 'Ввод отсека', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.25,
    rows: [
      {
        id: 'FU', to: 'BUS', rated: 0.25,
        items: [{
          id: 'FU1', kind: 'fuse', name: 'Предохранитель отсека', silk: 'FU1', value: 0.25, blown: false,
          showValue: true, valueText: (p) => (p.blown ? 'сгорел' : '250 мА'),
          interact: {
            type: 'pick', title: 'Предохранитель', hint: 'Нажми, чтобы заменить сгоревший',
            options: () => [{ label: 'поставить новый', note: '250 мА', value: 0.25, blown: false }],
          },
        }],
      },
      {
        id: 'DV', from: 'BUS', rated: 0.02,
        items: [
          deckSocket('RC', 'Верхнее плечо опоры', { silk: 'RC', title: 'Верхнее плечо опоры', jumper: false, rated: { pMax: 2.0, tau: 1.0 } }),
          { id: 'R4', kind: 'resistor', name: 'Нижнее плечо опоры', silk: 'R4', value: 220, showValue: true, rated: { pMax: 2.0, tau: 1.0 } },
        ],
      },
      {
        id: 'LP', from: 'BUS', rated: 0.16,
        items: [
          deckSocket('RA', 'Балласт освещения', { silk: 'RA', title: 'Балласт освещения', jumper: false, rated: { pMax: 2.0, tau: 1.0 } }),
          { id: 'HL1', kind: 'lamp', name: 'Освещение отсека', silk: 'HL1', value: 30, rated: { pNom: 0.72, pMax: 2.5, tau: 1.0 } },
        ],
      },
      {
        id: 'DP', from: 'BUS', rated: 0.05,
        items: [
          deckSocket('RB', 'Балласт прибора', { silk: 'RB', title: 'Балласт прибора', jumper: false, rated: { pMax: 2.0, tau: 1.0 } }),
          { id: 'D2', kind: 'device', name: 'Прибор отсека', silk: 'A1', value: 220, rated: { pMax: 2.0, tau: 1.2 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'd_restore',
    index: 60,
    title: 'Восстановление отсека',
    teaches: 'три условия одновременно',
    silk: 'RST-3X-46',
    diag: 'ДИАГНОСТИКА · Узел Д-06: отсек обесточен, все три балласта вынуты.',
    brief: 'Отсек целиком: освещение на 0,71 Вт, прибор на 0,305 Вт и опора 3,80 В для его входа. Все три гнезда пустые, предохранитель на 250 мА цел. Ветки независимы, но предохранитель у них общий.',
    lesson: 'Здесь ничего нового: мощность через ток и сопротивление, делитель через отношение плеч, предохранитель через сумму. Новое одно — всё это держится одновременно. Ветки на общей шине друг другу не мешают, пока хватает предохранителя, поэтому считать их можно по одной; но проверять узел приходится целиком, потому что зачёт даёт только совпадение всех трёх сразу.',
    reveal: 'Жилой отсек. Освещение, прибор и его опора — всё, что нужно человеку, чтобы здесь находиться. Гнёзда пустые: отсюда забрали даже балласты.',
    hints: [
      'Настраивай по одной ветке: они на общей шине, но друг другу почти не мешают.',
      'Мощность лампы — это ток в квадрате на её тридцать ом. Отсюда ток, отсюда балласт.',
      'Опора — обычный делитель: нижнее плечо 220 ом, и на нём должно остаться 3,8 вольта из двенадцати.',
    ],
    codex: ['power', 'divider', 'fuse', 'ohm', 'lamp'],
    vmax: 12.0,
    hold: 3.5,
    scale: DB.xl.scale,
    board: DB.xl.board,
    map: { pos: vec(323, 265), radius: 900, color: hex(0x8fd0ff), from: ['d_clamp', 'd_load'], icon: { kind: 'lamp' } },
    goalText: 'Освещение 0,71 Вт, прибор 0,305 Вт, опора 3,80 В — всё сразу.',
    scope: { label: 'Общий ток отсека', get: (m) => m.total, min: 0, max: 0.35, band: [0, 0.25], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    tick(dt, P, m, refs, c, api) {
      if (!P.FU1.blown && m.total > P.FU1.value) {
        P.FU1.blown = true;
        api.flash('Предохранитель отсека сгорел: суммарный ток превысил 250 мА', 'bad');
      }
    },

    read(sol, refs, P) {
      const iLamp = Math.abs(sol.componentCurrent.HL1 || 0);
      const iDev = Math.abs(sol.componentCurrent.D2 || 0);
      const iDiv = Math.abs(sol.componentCurrent.R4 || 0);
      const pLamp = iLamp * iLamp * 30;
      const pDev = iDev * iDev * 220;
      const ref = sol.nodeVoltage.DV_1 || 0;
      return {
        iLamp, iDev, iDiv, pLamp, pDev, ref,
        total: iLamp + iDev + iDiv,
        blown: !!P.FU1.blown,
        okLamp: inPct(pLamp, 0.711, 0.08),
        okDev: inPct(pDev, 0.305, 0.08),
        okRef: inPct(ref, 3.80, 0.05),
      };
    },

    status(m) {
      if (m.blown) return ['Предохранитель отсека сгорел: сумма токов вышла за 250 мА. Замени его.', 'bad'];
      const n = [m.okLamp, m.okDev, m.okRef].filter(Boolean).length;
      if (n === 3) return ['Отсек восстановлен целиком: свет, прибор и его опора.', 'good'];
      if (n === 0) return ['Отсек обесточен. Начинай с любой ветки — они друг другу не мешают.', 'neutral'];
      return ['Готово веток: ' + n + ' из 3.', 'warn'];
    },

    goal(m) {
      if (m.blown) return { ok: false, note: 'Предохранитель сгорел — замени его.' };
      return {
        ok: m.okLamp && m.okDev && m.okRef,
        note: fmtWatts(m.pLamp) + ' · ' + fmtWatts(m.pDev) + ' · ' + fmtVolts(m.ref),
      };
    },

    score(m) {
      if (m.blown) return 0;
      return (bandScore(m.pLamp, 0.711, 0.08) + bandScore(m.pDev, 0.305, 0.08) + bandScore(m.ref, 3.80, 0.05)) / 3;
    },
    scoreNote(m) { return 'Отсек берёт ' + fmtAmps(m.total) + ' — все три ветки вместе, и предохранитель это держит'; },

    meter(m) {
      return [
        ['Освещение → 0,71 Вт', fmtWatts(m.pLamp), m.okLamp ? 'good' : 'warn'],
        ['Прибор → 0,305 Вт', fmtWatts(m.pDev), m.okDev ? 'good' : 'warn'],
        ['Опора → 3,80 В', fmtVolts(m.ref), m.okRef ? 'good' : 'warn'],
        ['Всего', fmtAmps(m.total), m.total > 0.25 ? 'bad' : ''],
        ['Предохранитель', m.blown ? 'сгорел' : '250 мА', m.blown ? 'bad' : 'good'],
      ];
    },
  }));
})();
