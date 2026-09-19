'use strict';
// Ж-03 · Узел не только берёт питание от соседа, но и передаёт его дальше.
// Общий провод на входе несёт СУММУ двух токов — своего и транзитного, — и
// выбирать его надо по сумме. Средний вариант проходит по напряжению и
// сгорает по нагреву: это и есть отсев.

(() => {
  const CABLE = [
    { label: 'жила 0,5 мм²', note: '10 Ом', content: { kind: 'resistor', value: 10 } },
    { label: 'жила 1,0 мм²', note: '4,7 Ом', content: { kind: 'resistor', value: 4.7 } },
    { label: 'жила 2,5 мм²', note: '1,8 Ом', content: { kind: 'resistor', value: 1.8 } },
  ];

  const L = Rig.rows({
    id: 'u_transit',
    board: DB.xl.board,
    busX: { BUS: 0.45 },
    rated: 0.7,
    feeds: [
      { id: 'INA', tag: 'ввод от Ж-02', name: 'Ввод от соседнего узла', label: '12 В', silk: 'XT1', value: 12, rInt: SUPPLY_R.BENCH },
    ],
    rows: [
      {
        id: 'LN', from: 'INA', to: 'BUS', rated: 0.7,
        items: [
          {
            id: 'W1', kind: 'socket', name: 'Общий провод ввода', silk: 'W1',
            showValue: true, valueText: socketLabel, content: null,
            rated: { pMax: 0.8, tau: 1.2 },
            interact: {
              type: 'pick', title: 'Каким проводом заводить питание',
              hint: 'Нажми, чтобы выбрать сечение',
              options: () => [{ label: 'нет провода', note: 'разомкнуть', content: null }].concat(CABLE),
            },
          },
        ],
      },
      {
        id: 'OWN', from: 'BUS', rated: 0.35,
        items: [{ id: 'RL', kind: 'device', name: 'Своя нагрузка', silk: 'A1', label: 'нагрузка', value: 47, showValue: true, rated: { pMax: 6.0, tau: 1.5 } }],
      },
      {
        id: 'TR', from: 'BUS', rated: 0.4,
        items: [{ id: 'RT', kind: 'device', name: 'Транзит дальше, к соседу', silk: 'A2', label: 'транзит', value: 33, showValue: true, rated: { pMax: 6.0, tau: 1.5 } }],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'u_transit',
    index: 80,
    title: 'Транзит',
    teaches: 'общий провод несёт сумму токов',
    silk: 'TRN-555-80',
    diag: 'ДИАГНОСТИКА · Узел Ж-03: провод ввода выгорает, дальний сосед остаётся без питания.',
    brief: 'Этот узел не только питается сам, но и пропускает питание дальше — к следующему соседу. Оба тока идут по одному общему проводу на входе. Нужно, чтобы на шине держалось не меньше 9,3 вольта, и чтобы провод это выдержал: он рассчитан на 0,8 ватта.',
    lesson: 'Провод, по которому идёт и свой ток, и транзитный, греется от их СУММЫ, а не от своей половины. Поэтому сечение такого провода считают по полному току — и часто оказывается, что жила, которой хватило бы на собственную нагрузку, на транзит уже не годится. Проверять надо обе вещи сразу: сколько вольт доходит до шины (это про сопротивление провода) и сколько ватт остаётся в нём самом (это про его нагрев). Первое можно выполнить и сгореть на втором.',
    reveal: 'Проходной узел линии. Через него запитан весь дальний конец платы — и именно поэтому он выгорал чаще всех остальных вместе взятых.',
    hints: [
      'Смотри сразу на три строки: свой ток, ток транзита и сумму по общему проводу.',
      'Мощность на проводе — это его сопротивление, умноженное на КВАДРАТ полного тока.',
      'Средний провод по напряжению проходит, но по нагреву — нет. Проверь его и убедись сам.',
    ],
    codex: ['power', 'wire', 'ohm', 'current', 'series'],
    vmax: 12.0,
    hold: 2.5,
    scale: DB.xl.scale,
    board: DB.xl.board,
    map: { pos: vec(0, 1180), radius: 900, color: hex(0xff5b3d), from: ['u_bridge', 'e_reserve'], icon: { kind: 'jumper' } },
    goalText: 'На шине не ниже 9,3 В, и общий провод должен это выдержать.',
    scope: { label: 'Напряжение шины', get: (m) => m.vBus, min: 0, max: 12, band: [9.3, 12], fmt: fmtVolts },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const iOwn = Math.abs(sol.componentCurrent.RL || 0);
      const iTr = Math.abs(sol.componentCurrent.RT || 0);
      const total = Math.abs(sol.componentCurrent.W1 || 0);
      const vBus = sol.nodeVoltage.BUS || 0;
      const empty = !P.W1.content;
      return {
        iOwn, iTr, total, empty,
        vBus: empty ? 0 : vBus,
        pWire: P.W1.p || 0,
        heat: clamp(P.W1.heat || 0, 0, 1),
        burnt: !!P.W1.burnt,
        r: P.W1.content ? P.W1.content.value : 0,
        ok: !P.W1.burnt && !empty && vBus >= 9.3,
      };
    },

    status(m) {
      if (m.burnt) return ['Общий провод выгорел: по напряжению он проходил, а сумму двух токов не выдержал. Замени и возьми жилу толще.', 'bad'];
      if (m.empty) return ['Провода нет — узел обесточен, и сосед за ним тоже.', 'neutral'];
      if (m.heat > 0.8 && m.ok) return ['Напряжение держится, но провод раскалён: сумма токов ему не по силам.', 'warn'];
      if (m.ok) return ['На шине хватает и своей нагрузке, и транзиту, и провод держит сумму спокойно.', 'good'];
      return ['На шине всего ' + fmtVolts(m.vBus) + ': слишком много падает на самом проводе.', 'warn'];
    },

    goal(m) {
      if (m.burnt) return { ok: false, note: 'Общий провод выгорел — замени его.' };
      if (m.empty) return { ok: false, note: 'Провод не поставлен.' };
      return { ok: m.ok, note: 'На шине ' + fmtVolts(m.vBus) + ', нужно не ниже 9,3 В' };
    },

    score(m) { return m.ok ? clamp(1 - m.heat * 0.4, 0, 1) : 0; },
    scoreNote(m) { return 'По общему проводу ' + fmtAmps(m.total) + ' при нагреве ' + Math.round(m.heat * 100) + '%, на шине ' + fmtVolts(m.vBus); },

    meter(m) {
      return [
        ['Напряжение шины', m.empty ? '—' : fmtVolts(m.vBus), m.ok ? 'good' : 'warn'],
        ['Свой ток', fmtAmps(m.iOwn)],
        ['Ток транзита', fmtAmps(m.iTr)],
        ['По общему проводу', fmtAmps(m.total)],
        ['Греется провод', m.empty ? '—' : fmtWatts(m.pWire), m.heat > 0.8 ? 'bad' : ''],
        ['Провод держит', '0,8 Вт'],
      ];
    },
  }));
})();
