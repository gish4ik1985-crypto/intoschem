'use strict';
// Е-06 · Длинная линия. Первый узел, где сопротивление есть у САМОГО ПРОВОДА,
// и выбирать надо не деталь, а кабель. Числа настоящие по смыслу: чем тоньше
// жила, тем больше ом на ту же длину.

(() => {
  const CABLE = [
    { label: 'жила 0,5 мм²', note: '47 Ом на длину', content: { kind: 'resistor', value: 47 } },
    { label: 'жила 1,0 мм²', note: '22 Ом на длину', content: { kind: 'resistor', value: 22 } },
    { label: 'жила 2,5 мм²', note: '10 Ом на длину', content: { kind: 'resistor', value: 10 } },
  ];

  const L = Rig.rows({
    id: 'e_line',
    board: DB.s.board,
    supply: { id: 'SUP', name: 'Ввод узла', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.15,
    rows: [
      {
        id: 'LN', rated: 0.15,
        items: [
          {
            id: 'W1', kind: 'socket', name: 'Кабель наверх', silk: 'W1',
            showValue: true, valueText: socketLabel, content: null,
            rated: { pMax: 3.0, tau: 1.5 },
            interact: {
              type: 'pick', title: 'Каким кабелем тянуть',
              hint: 'Нажми, чтобы выбрать сечение',
              options: () => [{ label: 'нет кабеля', note: 'разомкнуть', content: null }].concat(CABLE),
            },
          },
          { id: 'D1', kind: 'device', name: 'Прибор наверху', silk: 'A1', value: 100, showValue: true, rated: { pMax: 3.0, tau: 1.5 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'e_line',
    index: 67,
    title: 'Длинная линия',
    teaches: 'провод — это тоже сопротивление',
    silk: 'LIN-108-67',
    diag: 'ДИАГНОСТИКА · Узел Е-06: кабель до верхнего прибора не проложен.',
    brief: 'Прибор стоит наверху, у самого люка, и до него далеко. Он работает, если на его клеммах не меньше 10,5 вольта. На шине честные двенадцать. В ящике три кабеля разного сечения — выбери, каким тянуть.',
    lesson: 'Идеальных проводов не бывает: у каждой жилы есть своё сопротивление, и чем она тоньше и длиннее, тем его больше. На длинной линии это перестаёт быть мелочью — часть напряжения оседает в самом проводе, и до потребителя доходит уже не то, что было на шине. Поэтому сечение выбирают не «чтобы влезло», а по допустимой потере: считают падение на линии при рабочем токе и смотрят, сколько остаётся на конце.',
    reveal: 'Линия к точке подъёма. Кабель с неё срезан начисто — не перекушен, а именно снят, аккуратно, целиком. Он кому-то понадобился где-то ещё.',
    hints: [
      'Поставь любой кабель и посмотри, сколько вольт осело на нём самом.',
      'Ток в ветке один и тот же, значит падение на кабеле — это его сопротивление, умноженное на этот ток.',
      'На приборе должно остаться не меньше 10,5 В, значит кабелю можно отдать не больше полутора.',
    ],
    codex: ['wire', 'ohm', 'series', 'power', 'resistor'],
    vmax: 12.0,
    hold: 2.5,
    scale: DB.s.scale,
    board: DB.s.board,
    map: { pos: vec(430, 795), radius: 900, color: hex(0x8fd88f), from: ['e_pair', 'e_share'], icon: { kind: 'jumper' } },
    goalText: 'На верхнем приборе — не меньше 10,5 В.',
    scope: { label: 'Напряжение на приборе', get: (m) => m.uDev, min: 0, max: 12, band: [10.5, 12], fmt: fmtVolts },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const i = Math.abs(sol.componentCurrent.D1 || 0);
      const uDev = sol.nodeVoltage.LN_1 || 0;
      const uLine = (sol.nodeVoltage.VCC || 0) - uDev;
      const empty = !P.W1.content;
      return {
        i, empty,
        uDev: empty ? 0 : uDev,
        uLine: empty ? 0 : uLine,
        pLine: empty ? 0 : uLine * i,
        r: P.W1.content ? P.W1.content.value : 0,
        ok: !empty && uDev >= 10.5,
      };
    },

    status(m) {
      if (m.empty) return ['Кабеля нет — линия разомкнута.', 'neutral'];
      if (m.ok) return ['На приборе ' + fmtVolts(m.uDev) + ': кабель отдаёт себе меньше полутора вольт.', 'good'];
      return ['На приборе всего ' + fmtVolts(m.uDev) + ': слишком много осело на самом кабеле. Нужна жила потолще.', 'warn'];
    },

    goal(m) {
      if (m.empty) return { ok: false, note: 'Кабель не проложен.' };
      return { ok: m.ok, note: 'На приборе ' + fmtVolts(m.uDev) + ', нужно не меньше 10,5 В' };
    },

    score(m) { return m.ok ? bandScore(m.uDev, 10.9, 0.05) : 0; },
    scoreNote(m) { return 'Кабель ' + fmtOhms(m.r) + ': на нём теряется ' + fmtVolts(m.uLine) + ', до прибора доходит ' + fmtVolts(m.uDev); },

    meter(m) {
      return [
        ['На приборе', m.empty ? '—' : fmtVolts(m.uDev), m.ok ? 'good' : 'warn'],
        ['Потеряно в кабеле', m.empty ? '—' : fmtVolts(m.uLine)],
        ['Ток линии', fmtAmps(m.i)],
        ['Греется кабель', m.empty ? '—' : fmtWatts(m.pLine)],
        ['Нужно', 'не ниже 10,5 В'],
      ];
    },
  }));
})();
