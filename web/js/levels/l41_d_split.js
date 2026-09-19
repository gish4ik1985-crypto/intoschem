'use strict';
// Д-01 · Три ветки под одним предохранителем. Каждая считается отдельно —
// напряжение у них общее, а ток свой; но предохранитель видит их сумму, и
// про него забывают ровно до того момента, когда он перегорает.

(() => {
  const L = Rig.rows({
    id: 'd_split',
    board: DB.xl.board,
    busX: { BUS: 0.30 },
    supply: { id: 'SUP', name: 'Ввод ядра', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.13,
    rows: [
      {
        id: 'FU', to: 'BUS', rated: 0.13,
        items: [{
          id: 'FU1', kind: 'fuse', name: 'Предохранитель ядра', silk: 'FU1', value: 0.13, blown: false,
          showValue: true, valueText: (p) => (p.blown ? 'сгорел' : '130 мА'),
          interact: {
            type: 'pick', title: 'Предохранитель', hint: 'Нажми, чтобы заменить сгоревший',
            options: () => [{ label: 'поставить новый', note: '130 мА', value: 0.13, blown: false }],
          },
        }],
      },
      {
        id: 'A', from: 'BUS', rated: 0.08,
        items: [
          deckSocket('RA', 'Балласт первой ветки', { silk: 'RA', title: 'Балласт первой ветки', jumper: false, rated: { pMax: 2.0, tau: 1.0 } }),
          { id: 'D1', kind: 'resistor', name: 'Первый потребитель', silk: 'R1', value: 100, showValue: true, rated: { pMax: 2.0, tau: 1.0 } },
        ],
      },
      {
        id: 'B', from: 'BUS', rated: 0.05,
        items: [
          deckSocket('RB', 'Балласт второй ветки', { silk: 'RB', title: 'Балласт второй ветки', jumper: false, rated: { pMax: 2.0, tau: 1.0 } }),
          { id: 'D2', kind: 'resistor', name: 'Второй потребитель', silk: 'R2', value: 220, showValue: true, rated: { pMax: 2.0, tau: 1.0 } },
        ],
      },
      {
        id: 'C', from: 'BUS', rated: 0.03,
        items: [
          deckSocket('RC', 'Балласт третьей ветки', { silk: 'RC', title: 'Балласт третьей ветки', jumper: false, rated: { pMax: 2.0, tau: 1.0 } }),
          { id: 'D3', kind: 'resistor', name: 'Третий потребитель', silk: 'R3', value: 470, showValue: true, rated: { pMax: 2.0, tau: 1.0 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'd_split',
    index: 55,
    title: 'Развилка ядра',
    teaches: 'мощность ветки и сумма токов',
    silk: 'SPL-506-41',
    diag: 'ДИАГНОСТИКА · Узел Д-01: все три ветки без балластов, предохранитель цел.',
    brief: 'Три потребителя ядра. Паспорт задаёт каждому не ток, а мощность: 506, 230 и 76 милливатт. Балласты вынуты из всех трёх гнёзд. Общий предохранитель держит 130 мА, и считает он сумму, а не каждую ветку по отдельности.',
    lesson: 'Ветки на общей шине независимы: у каждой своё сопротивление и свой ток, и настраивать их можно по одной. Но предохранитель стоит ДО развилки и видит их сумму — поэтому его проверяют не по самой жадной ветке, а по всем сразу. Мощность потребителя — это его ток в квадрате на его сопротивление; отсюда и считается ток, а из тока — балласт.',
    reveal: 'Развилка питания ядра. Три ветки — три подсистемы. Балласты вынуты аккуратно и сложены рядом: ядро глушили намеренно, а не оно сломалось.',
    hints: [
      'Мощность потребителя — это его ток в квадрате, умноженный на его сопротивление. Отсюда находится нужный ток ветки.',
      'Дальше обычный закон Ома: двенадцать вольт делить на нужный ток — это сопротивление всей ветки. Вычти из него сам потребитель.',
      'Первой ветке нужно около 71 мА, второй 32, третьей 13. Вместе — 116, и предохранитель это выдержит.',
    ],
    codex: ['power', 'ohm', 'fuse', 'current', 'divider'],
    vmax: 12.0,
    hold: 3.0,
    scale: DB.xl.scale,
    board: DB.xl.board,
    map: { pos: vec(-107, 100), radius: 900, color: hex(0xff5b3d), from: ['b_parallel', 'v_cal'], icon: { kind: 'fuse' } },
    goalText: 'Мощности веток 506, 230 и 76 мВт (±8%), предохранитель цел.',
    scope: { label: 'Общий ток ядра', get: (m) => m.total, min: 0, max: 0.2, band: [0, 0.13], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    // Плавкая вставка — механика вне матрицы: смотрим ток и решаем, цела она
    // или уже нет.
    tick(dt, P, m, refs, c, api) {
      if (!P.FU1.blown && m.total > P.FU1.value) {
        P.FU1.blown = true;
        api.flash('Предохранитель ядра сгорел: сумма токов превысила 130 мА', 'bad');
      }
    },

    read(sol, refs, P) {
      const ia = Math.abs(sol.componentCurrent.D1 || 0);
      const ib = Math.abs(sol.componentCurrent.D2 || 0);
      const ic = Math.abs(sol.componentCurrent.D3 || 0);
      const pa = ia * ia * 100, pb = ib * ib * 220, pc = ic * ic * 470;
      return {
        ia, ib, ic, pa, pb, pc,
        total: ia + ib + ic,
        blown: !!P.FU1.blown,
        okA: inPct(pa, 0.506, 0.08),
        okB: inPct(pb, 0.230, 0.08),
        okC: inPct(pc, 0.076, 0.08),
      };
    },

    status(m) {
      if (m.blown) return ['Предохранитель ядра сгорел: сумма токов веток вышла за 130 мА. Замени его.', 'bad'];
      const n = [m.okA, m.okB, m.okC].filter(Boolean).length;
      if (n === 3) return ['Все три ветки в паспортной мощности, и сумма укладывается в предохранитель.', 'good'];
      if (n === 0) return ['Ни одна ветка пока не настроена. Считай каждую отдельно — они друг другу не мешают.', 'neutral'];
      return ['Настроено веток: ' + n + ' из 3.', 'warn'];
    },

    goal(m) {
      if (m.blown) return { ok: false, note: 'Предохранитель сгорел — замени его.' };
      return {
        ok: m.okA && m.okB && m.okC,
        note: fmtWatts(m.pa) + ' · ' + fmtWatts(m.pb) + ' · ' + fmtWatts(m.pc),
      };
    },

    score(m) {
      if (m.blown) return 0;
      return (bandScore(m.pa, 0.506, 0.08) + bandScore(m.pb, 0.230, 0.08) + bandScore(m.pc, 0.076, 0.08)) / 3;
    },
    scoreNote(m) { return 'Сумма токов веток ' + fmtAmps(m.total) + ' — ровно то, что идёт через предохранитель'; },

    meter(m) {
      return [
        ['Первая → 506 мВт', fmtWatts(m.pa), m.okA ? 'good' : 'warn'],
        ['Вторая → 230 мВт', fmtWatts(m.pb), m.okB ? 'good' : 'warn'],
        ['Третья → 76 мВт', fmtWatts(m.pc), m.okC ? 'good' : 'warn'],
        ['Сумма токов', fmtAmps(m.total), m.total > 0.13 ? 'bad' : ''],
        ['Предохранитель', m.blown ? 'сгорел' : '130 мА', m.blown ? 'bad' : 'good'],
      ];
    },
  }));
})();
