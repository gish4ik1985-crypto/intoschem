'use strict';
// Т-10 · Мощность. До сих пор все сборки просили ток. Эта просит ватты — и
// это первая величина, которую нельзя прочитать с одного прибора: её надо
// перемножить из двух.

(() => {
  const L = Rig.rows({
    id: 't_power',
    board: DB.s.board,
    supply: { id: 'SUP', name: 'Питание стенда', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.3,
    rows: [
      {
        id: 'BR', rated: 0.3,
        items: [
          deckSocket('R1', 'Гнездо балласта', { silk: 'R1', title: 'Что поставить в гнездо', jumper: false, rated: { pMax: 3.0, tau: 1.0 } }),
          { id: 'HL1', kind: 'lamp', name: 'Рабочая лампа', silk: 'HL1', value: 47, showValue: true, rated: { pNom: 1.4, pMax: 4.0, tau: 1.2 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 't_power',
    index: 10,
    title: 'Мощность',
    teaches: 'мощность = напряжение × ток',
    silk: 'STD-010',
    diag: 'СТЕНД · Сборка Т-10: лампа не выведена на паспортную мощность.',
    brief: 'Лампе нужна мощность 1,4 ватта: не тусклее и не ярче. Подбери резистор.',
    lesson: 'Мощность — это напряжение, умноженное на ток. Вся она уходит в тепло и свет, поэтому именно ватты решают, сгорит ли деталь.',
    reveal: 'Пункт десятый: «Считай ватты, а не амперы. Всё, что здесь сгорело за годы, сгорело потому, что кто-то смотрел на ток и не смотрел на нагрев».',
    hints: [
      'Мощность лампы — это её напряжение, умноженное на её ток. Оба числа есть на приборах.',
      'Прикинь наоборот: если на лампе 47 ом, то при токе I мощность равна I × I × 47.',
      'Много ватт — бери резистор побольше, мало — поменьше.',
    ],
    codex: ['power', 'ohm', 'resistor', 'lamp', 'current'],
    vmax: 12.0,
    hold: 2.5,
    scale: DB.s.scale,
    board: DB.s.board,
    map: { pos: vec(-430, -1085), radius: 900, color: hex(0xff8a4a), from: ['t_loop', 't_short'], icon: { kind: 'lamp' } },
    goalText: 'Лампа светит как положено — бегунок в зелёной зоне.',
    gauge: { lowWord: 'тускло', highWord: 'перегрев', low: 'Тускло — возьми резистор поменьше.', high: 'Лампа перегревается — возьми резистор побольше.' },
    scope: { label: 'Мощность лампы', get: (m) => m.pLamp, min: 0, max: 3, band: [1.288, 1.512], fmt: fmtWatts },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const i = Math.abs(sol.componentCurrent.HL1 || 0);
      const uLamp = sol.nodeVoltage.BR_1 || 0;
      const uRes = (sol.nodeVoltage.VCC || 0) - uLamp;
      return {
        i, uLamp, uRes,
        pLamp: uLamp * i,
        pRes: uRes * i,
        empty: !P.R1.content,
        r: P.R1.content ? P.R1.content.value : 0,
        ok: inPct(uLamp * i, 1.4, 0.08),
      };
    },

    status(m) {
      if (m.empty) return ['Гнездо пустое — ветка разомкнута, мощности нет нигде.', 'neutral'];
      if (m.ok) return ['Один и четыре десятых ватта. Лампа в паспортном режиме.', 'good'];
      if (m.pLamp > 1.512) return ['Лампе достаётся слишком много ватт — она перегреется. Балласт мал.', 'warn'];
      return ['Лампе достаётся слишком мало ватт — она еле светит. Балласт велик.', 'warn'];
    },

    goal(m) {
      return { ok: m.ok, note: 'На лампе ' + fmtWatts(m.pLamp) + ', нужно 1,4 Вт' };
    },

    score(m) { return bandScore(m.pLamp, 1.4, 0.08); },
    scoreNote(m) { return 'На лампе ' + fmtVolts(m.uLamp) + ' × ' + fmtAmps(m.i) + ' = ' + fmtWatts(m.pLamp); },

    meter(m) {
      return [
        ['Мощность лампы', fmtWatts(m.pLamp), m.ok ? 'good' : 'warn'],
        ['На лампе', m.empty ? '—' : fmtVolts(m.uLamp)],
        ['Ток', fmtAmps(m.i)],
        ['Греется балласт', m.empty ? '—' : fmtWatts(m.pRes)],
        ['Нужно', '1,4 Вт'],
      ];
    },
  }));
})();
