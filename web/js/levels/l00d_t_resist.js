'use strict';
// Т-04 · Первое знакомство с номиналом. Считать ещё нечего: в ящике всего
// три резистора, разница между ними стократная, и нужный виден по прибору
// с первой попытки. Задача сборки — связать в голове две вещи, которые до
// сих пор были отдельными: цифру на детали и стрелку прибора.

(() => {
  const KIT = [10, 100, 1000];
  const L = Rig.rows({
    id: 't_resist',
    board: DB.s.board,
    supply: { id: 'SUP', name: 'Питание стенда', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.4,
    rows: [
      {
        id: 'BR', rated: 0.4,
        items: [
          deckSocket('R1', 'Гнездо резистора', {
            silk: 'R1', title: 'Какой резистор поставить', jumper: false, kit: KIT,
            rated: { pMax: 2.0, tau: 1.0 },
          }),
          { id: 'HL1', kind: 'lamp', name: 'Контрольная лампа', silk: 'HL1', value: 22, rated: { pNom: 0.22, pMax: 5.0, tau: 1.2 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 't_resist',
    index: 4,
    title: 'Резистор мешает току',
    teaches: 'больше сопротивление — меньше ток',
    silk: 'STD-004',
    diag: 'СТЕНД · Сборка Т-04: гнездо резистора пустое.',
    brief: 'В ящике три резистора: десять ом, сто ом и тысяча. Нужно, чтобы в ветке шло сто миллиампер. Считать ничего не надо — поставь любой, посмотри на прибор, поставь следующий.',
    lesson: 'Резистор — это деталь, которая мешает току, и цифра на ней говорит, насколько сильно. Чем больше ом, тем меньше ампер при том же напряжении, и наоборот. Пока достаточно чувства: десять ом — много тока, тысяча — почти ничего. Считать это точно ты научишься на следующей сборке.',
    reveal: 'Пункт четвёртый: «Ящик с резисторами стоит там же, где всегда. Я ничего оттуда не брал, кроме одного номинала. Он тебе понадобится в самом конце, и ты поймёшь, когда».',
    hints: [
      'Нажми на гнездо и выбери первый попавшийся номинал — потом посмотри на ток.',
      'Десять ом — самый маленький из трёх, значит и мешает току меньше всех.',
      'Нужны сто миллиампер. Один из трёх номиналов даёт почти ровно столько.',
    ],
    codex: ['resistor', 'current', 'ohm', 'circuit'],
    vmax: 12.0,
    hold: 2.0,
    scale: DB.s.scale,
    board: DB.s.board,
    map: { pos: vec(215, -1250), radius: 900, color: hex(0xff8a4a), from: 't_ground', icon: { kind: 'resistor', value: 100 } },
    goalText: 'Ток в ветке — 100 мА (допуск ±10%).',
    scope: { label: 'Ток в ветке', get: (m) => m.i, min: 0, max: 0.45, band: [0.09, 0.11], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const i = Math.abs(sol.componentCurrent.HL1 || 0);
      return {
        i,
        empty: !P.R1.content,
        r: P.R1.content ? P.R1.content.value : 0,
        uRes: (sol.nodeVoltage.VCC || 0) - (sol.nodeVoltage.BR_1 || 0),
        uLamp: sol.nodeVoltage.BR_1 || 0,
        ok: inPct(i, 0.1, 0.10),
      };
    },

    status(m) {
      if (m.empty) return ['Гнездо пустое — ветка разомкнута, тока нет.', 'neutral'];
      if (m.ok) return ['Сто миллиампер. Этот номинал и нужен.', 'good'];
      if (m.i > 0.11) return ['Тока слишком много: этот резистор мешает слишком слабо. Возьми номинал побольше.', 'warn'];
      return ['Тока слишком мало: этот резистор мешает слишком сильно. Возьми номинал поменьше.', 'warn'];
    },

    goal(m) {
      return { ok: m.ok, note: 'В ветке ' + fmtAmps(m.i) + ', нужно 100 мА' };
    },

    score(m) { return bandScore(m.i, 0.1, 0.10); },
    scoreNote(m) { return 'В гнезде ' + fmtOhms(m.r) + ', ток ' + fmtAmps(m.i); },

    meter(m) {
      return [
        ['Ток в ветке', fmtAmps(m.i), m.ok ? 'good' : 'warn'],
        ['В гнезде', m.empty ? 'пусто' : fmtOhms(m.r)],
        ['На резисторе', m.empty ? '—' : fmtVolts(m.uRes)],
        ['На лампе', m.empty ? '—' : fmtVolts(m.uLamp)],
        ['Нужно', '100 мА'],
      ];
    },
  }));
})();
