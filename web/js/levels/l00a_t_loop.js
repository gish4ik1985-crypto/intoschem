'use strict';
// Т-01 · Самая первая сборка на стенде. Учит ровно одному: ток идёт только по
// замкнутому кольцу. Ни одного числа считать не надо — в ящике всего два
// пункта, и один из них не замыкает ничего.

(() => {
  const L = Rig.rows({
    id: 't_loop',
    board: DB.s.board,
    supply: { id: 'SUP', name: 'Питание стенда', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.2,
    rows: [
      {
        id: 'LP', rated: 0.2,
        items: [
          {
            id: 'R1', kind: 'socket', name: 'Пустое гнездо', silk: 'X1',
            showValue: true, valueText: socketLabel, content: null,
            rated: { pMax: 2.0, tau: 1.0 },
            interact: {
              type: 'pick', title: 'Что положить в гнездо',
              hint: 'Нажми, чтобы выбрать',
              options: () => socketOptions({ empty: true, jumper: true, kit: [] }),
            },
          },
          { id: 'HL1', kind: 'lamp', name: 'Контрольная лампа', silk: 'HL1', value: 68, rated: { pNom: 2.1, pMax: 6.0, tau: 1.2 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 't_loop',
    index: 1,
    title: 'Замкнутое кольцо',
    teaches: 'цепь должна быть замкнута',
    silk: 'STD-001',
    diag: 'СТЕНД · Сборка Т-01: кольцо разорвано, лампа не горит.',
    brief: 'Лампа целая, а не горит. В гнезде пусто — положи туда перемычку.',
    lesson: 'Ток бежит только по замкнутому кругу: от плюса через лампу и обратно в минус. Разорвал круг в одном месте — ток встал везде.',
    reveal: 'На краю стенда лежит записка, написанная от руки. Пункт первый: «Если это читает не человек — значит, я не успел. Дальше по списку. Начни с самого простого, чтобы убедиться, что руки целы».',
    hints: [
      'Нажми на гнездо — откроется список того, что в него можно положить.',
      'Перемычка — это просто кусок голого провода. Она ничего не ограничивает, зато замыкает кольцо.',
      'Пока в гнезде «пусто», ток равен нулю, сколько ни смотри на приборы.',
      'Огоньки на проводах бегут от плюса к минусу — так принято рисовать ток. Почему так, написано в кодексе, в статье «Ток, напряжение, сопротивление».',
    ],
    codex: ['circuit', 'current', 'wire', 'lamp'],
    vmax: 12.0,
    hold: 1.5,
    scale: DB.s.scale,
    board: DB.s.board,
    map: { pos: vec(-430, -1250), radius: 900, color: hex(0xffc46b), start: true, icon: { kind: 'jumper' } },
    goalText: 'Замкни круг — пусть лампа загорится.',
    scope: { label: 'Ток в кольце', get: (m) => m.i, min: 0, max: 0.25, band: [0.05, 0.25], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const i = Math.abs(sol.componentCurrent.HL1 || 0);
      return {
        i,
        uLamp: sol.nodeVoltage.LP_1 || 0,
        empty: !P.R1.content,
        ok: i > 0.05,
      };
    },

    status(m) {
      if (m.ok) return ['Кольцо замкнуто, ток пошёл, лампа горит. Вот и вся первая сборка.', 'good'];
      return ['В гнезде пусто — кольца нет, тока нет нигде.', 'neutral'];
    },

    goal(m) {
      return { ok: m.ok, note: m.ok ? 'Ток в кольце ' + fmtAmps(m.i) : 'Тока нет: кольцо разорвано' };
    },

    score(m) { return m.ok ? 1 : 0; },
    scoreNote(m) { return 'По кольцу идёт ' + fmtAmps(m.i) + ' — этого хватает лампе с запасом'; },

    meter(m) {
      return [
        ['Ток в кольце', fmtAmps(m.i), m.ok ? 'good' : ''],
        ['На лампе', m.empty ? '—' : fmtVolts(m.uLamp)],
        ['В гнезде', m.empty ? 'пусто' : 'перемычка', m.empty ? 'warn' : 'good'],
      ];
    },
  }));
})();
