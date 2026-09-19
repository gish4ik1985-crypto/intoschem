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
    brief: 'Лампа рассчитана на 1,4 ватта: меньше — тускло, больше — она долго не проживёт. Ватт на приборах нет напрямую, зато есть напряжение и ток. Подбери балласт так, чтобы лампа получила свои 1,4 ватта.',
    lesson: 'Мощность — это сколько энергии деталь съедает каждую секунду, и получается она перемножением двух величин: напряжения НА ДЕТАЛИ и тока ЧЕРЕЗ НЕЁ. Одного тока мало: тот же ампер при двух вольтах и при двухстах — это совершенно разный нагрев. Вся эта мощность превращается в тепло и свет прямо в детали, поэтому именно ватты, а не амперы, решают, выживет она или нет.',
    reveal: 'Пункт десятый: «Считай ватты, а не амперы. Всё, что здесь сгорело за годы, сгорело потому, что кто-то смотрел на ток и не смотрел на нагрев».',
    hints: [
      'Мощность лампы — это её напряжение, умноженное на её ток. Оба числа есть на приборах.',
      'Прикинь наоборот: если на лампе 47 ом, то при токе I мощность равна I × I × 47.',
      'Нужен ток около 173 миллиампер. Двенадцать вольт делить на это — примерно 69 ом на всю ветку, лампа занимает 47.',
    ],
    codex: ['power', 'ohm', 'resistor', 'lamp', 'current'],
    vmax: 12.0,
    hold: 2.5,
    scale: DB.s.scale,
    board: DB.s.board,
    map: { pos: vec(-430, -1085), radius: 900, color: hex(0xff8a4a), from: ['t_loop', 't_short'], icon: { kind: 'lamp' } },
    goalText: 'Мощность лампы — 1,4 Вт (допуск ±8%).',
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
