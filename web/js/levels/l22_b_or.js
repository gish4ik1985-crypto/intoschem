'use strict';
// Б-14 · Вентиль и обход. Диод пропускает ток только в одну сторону — но не
// бесплатно: он забирает себе около семи десятых вольта, и на плате это видно
// как недостача, которой неоткуда взяться по закону Ома.

(() => {
  const L = Rig.rows({
    id: 'b_or',
    board: DB.l.board,
    busX: { LOAD: 0.45 },
    supply: { id: 'SUP', name: 'Ввод узла', label: '12 В', silk: 'G1', value: 12 },
    rows: [
      {
        id: 'DI', to: 'LOAD', rated: 0.25,
        items: [{ id: 'VD1', kind: 'diode', name: 'Вентиль ввода', silk: 'VD1' }],
      },
      {
        id: 'SW', to: 'LOAD', rated: 0.25,
        items: [deckToggle('SA1', 'Обход вентиля', false, 'Нажми, чтобы замкнуть обход вентиля')],
      },
      {
        id: 'LD', from: 'LOAD', rated: 0.25,
        items: [
          deckSocket('R1', 'Гнездо балласта', { silk: 'R1', title: 'Что поставить в гнездо', jumper: false, rated: { pMax: 2.2, tau: 1.0 } }),
          { id: 'HL1', kind: 'lamp', name: 'Лампа узла', silk: 'HL1', value: 30, rated: { pNom: 1.6, pMax: 3.5, tau: 1.0 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'b_or',
    index: 36,
    title: 'Вентиль ввода',
    teaches: 'падение на диоде',
    silk: 'ORD-012-22',
    diag: 'ДИАГНОСТИКА · Узел Б-14: на нагрузке не хватает почти вольта, при том что ток укладывается.',
    brief: 'Питание приходит в узел через вентиль, рядом с которым стоит обходной ключ. Паспорт требует на нагрузке не меньше 11,8 В и ток лампы 229 мА. Гнездо балласта пустое, ключ разомкнут.',
    lesson: 'Диод пропускает ток в одну сторону, но берёт за это плату: около семи десятых вольта остаются на нём и превращаются в тепло. Когда обходной ключ замкнут, он даёт току дорогу без потерь — и диод сразу перестаёт проводить вообще, потому что на нём больше нет разницы напряжений, которая его открывала.',
    reveal: 'Ввод от резервной линии. Вентиль стоит здесь, чтобы ток не пошёл обратно в резерв, когда основная линия под напряжением. Обход замкнут вручную — кто-то отключал резерв совсем.',
    hints: [
      'Наведи курсор на вентиль и посмотри, сколько вольт остаётся на нём самом.',
      'Ток по закону Ома может укладываться, а напряжения на нагрузке всё равно не хватать: вольт съедает вентиль.',
      'Обходной ключ пускает ток мимо вентиля. Балласт после этого нужен такой, чтобы ток был 229 мА при полных двенадцати вольтах.',
    ],
    codex: ['diode', 'ohm', 'series', 'lamp', 'resistor'],
    vmax: 12.0,
    hold: 2.5,
    scale: DB.l.scale,
    board: DB.l.board,
    map: { pos: vec(-537, 30), radius: 900, color: hex(0x6ee7a8), from: ['b_ballast', 'b_parallel'], icon: { kind: 'diode' } },
    goalText: 'На нагрузке не меньше 11,8 В и ток лампы 229 мА (±9%).',
    scope: { label: 'Напряжение на нагрузке', get: (m) => m.uLoad, min: 0, max: 12, band: [11.8, 12], fmt: fmtVolts },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const uLoad = sol.nodeVoltage.LOAD || 0;
      const i = Math.abs(sol.componentCurrent.HL1 || 0);
      return {
        uLoad, i,
        uDiode: (sol.nodeVoltage.VCC || 0) - uLoad,
        iDiode: Math.abs(sol.componentCurrent.VD1 || 0),
        bypass: !!P.SA1.closed,
        empty: !P.R1.content,
        uOk: uLoad >= 11.8,
        iOk: inPct(i, 0.229, 0.09),
      };
    },

    status(m) {
      if (m.empty) return ['Гнездо балласта пустое — тока в нагрузке нет.', 'neutral'];
      if (m.uOk && m.iOk) return ['Полные двенадцать на нагрузке и паспортный ток. Вентиль обойдён и больше ничего не отбирает.', 'good'];
      if (!m.uOk) return ['На нагрузке не хватает почти вольта: ток идёт через вентиль, и вольт остаётся на нём.', 'warn'];
      if (m.i > 0.25) return ['Напряжение в порядке, но балласт мал: ток выше паспортного.', 'warn'];
      return ['Напряжение в порядке, но балласт велик: ток ниже паспортного.', 'warn'];
    },

    goal(m) {
      if (m.empty) return { ok: false, note: 'Балласт не поставлен.' };
      if (!m.uOk) return { ok: false, note: 'На нагрузке ' + fmtVolts(m.uLoad) + ', нужно не меньше 11,8 В' };
      return { ok: m.iOk, note: 'Ток лампы ' + fmtAmps(m.i) + ', нужно 229 мА' };
    },

    score(m) { return m.uOk ? bandScore(m.i, 0.229, 0.09) : 0; },
    scoreNote(m) { return 'На нагрузке ' + fmtVolts(m.uLoad) + '; на вентиле осталось ' + fmtVolts(m.uDiode); },

    meter(m) {
      return [
        ['На нагрузке', fmtVolts(m.uLoad), m.uOk ? 'good' : 'warn'],
        ['Осталось на вентиле', fmtVolts(m.uDiode)],
        ['Ток через вентиль', fmtAmps(m.iDiode)],
        ['Ток лампы', fmtAmps(m.i), m.iOk ? 'good' : 'warn'],
        ['Обход', m.bypass ? 'замкнут' : 'разомкнут', m.bypass ? 'good' : ''],
      ];
    },
  }));
})();
