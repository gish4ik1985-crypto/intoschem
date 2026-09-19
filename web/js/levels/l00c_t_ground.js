'use strict';
// Т-03 · Обратный провод. Разрыв специально поставлен НЕ перед лампой, а
// после неё: пока не увидишь своими глазами, что «обратно» — такая же часть
// кольца, как «туда», земля остаётся словом из учебника.

(() => {
  const L = Rig.rows({
    // Петля одна, а значок нужен: урок ровно про него: обратный провод и есть тема Т-03.
    groundSymbol: true,
    id: 't_ground',
    board: DB.s.board,
    supply: { id: 'SUP', name: 'Питание стенда', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.25,
    rows: [
      {
        id: 'LP', rated: 0.25,
        items: [
          { id: 'HL1', kind: 'lamp', name: 'Контрольная лампа', silk: 'HL1', value: 68, rated: { pNom: 2.1, pMax: 6.0, tau: 1.2 } },
          {
            id: 'GP', kind: 'gap', name: 'Обрыв обратного провода', silk: 'W2', repaired: false,
            interact: { type: 'flag', field: 'repaired', hint: 'Нажми, чтобы запаять разрыв' },
          },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 't_ground',
    index: 3,
    title: 'Обратный провод',
    teaches: 'земля — это путь тока обратно',
    silk: 'STD-003',
    diag: 'СТЕНД · Сборка Т-03: обрыв на обратном проводе, лампа не горит.',
    brief: 'До лампы всё цело: питание подходит, напряжение на ней есть. А кольца всё равно нет — обугленный разрыв стоит ПОСЛЕ лампы, на обратном проводе к земле. Запаяй его.',
    lesson: 'Ток обязан вернуться туда, откуда вышел. Обратный провод — не «остаток схемы», а такая же её половина: без него не работает ничего, сколько бы напряжения ни подходило к лампе спереди. Этот общий обратный провод и называется землёй, и рисуют его отдельным значком просто потому, что он один на всех.',
    reveal: 'Пункт третий: «Обратный провод я перекусил сам. Это единственная поломка, оставленная нарочно, — чтобы никто не включил станцию, не разобравшись».',
    hints: [
      'Нажми на чёрное пятно разрыва — его можно запаять.',
      'Посмотри до пайки на строку «На разрыве»: там стоит всё напряжение, хотя разрыв уже за лампой.',
      'Кольцо не бывает наполовину. Обрыв на обратном пути гасит ток так же намертво, как обрыв на прямом.',
    ],
    codex: ['ground', 'circuit', 'current', 'wire'],
    vmax: 12.0,
    hold: 1.5,
    scale: DB.s.scale,
    board: DB.s.board,
    map: { pos: vec(0, -1250), radius: 900, color: hex(0x8fd0ff), from: 't_switch', icon: { kind: 'ground' } },
    goalText: 'Запаяй разрыв на обратном проводе — лампа должна загореться.',
    scope: { label: 'Ток в кольце', get: (m) => m.i, min: 0, max: 0.25, band: [0.05, 0.25], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const i = Math.abs(sol.componentCurrent.HL1 || 0);
      const vcc = sol.nodeVoltage.VCC || 0;
      return {
        i,
        fixed: !!P.GP.repaired,
        uLamp: vcc - (sol.nodeVoltage.LP_1 || 0),
        uGap: sol.nodeVoltage.LP_1 || 0,
        ok: i > 0.05,
      };
    },

    status(m) {
      if (m.ok) return ['Обратный провод цел, кольцо замкнулось, лампа горит.', 'good'];
      return ['Разрыв на обратном проводе. Напряжение к лампе подходит, а вернуться току некуда.', 'neutral'];
    },

    goal(m) {
      return { ok: m.ok, note: m.ok ? 'Ток ' + fmtAmps(m.i) : 'Обратный провод разорван' };
    },

    score(m) { return m.ok ? 1 : 0; },
    scoreNote(m) { return 'Кольцо целиком: ток ' + fmtAmps(m.i) + ' уходит в лампу и возвращается по земле'; },

    meter(m) {
      return [
        ['Ток в кольце', fmtAmps(m.i), m.ok ? 'good' : ''],
        ['На лампе', fmtVolts(m.uLamp)],
        ['На разрыве', fmtVolts(m.uGap), m.fixed ? '' : 'warn'],
        ['Обратный провод', m.fixed ? 'цел' : 'разорван', m.fixed ? 'good' : 'bad'],
      ];
    },
  }));
})();
