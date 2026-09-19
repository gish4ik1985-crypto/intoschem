'use strict';
// Т-11 · Диод. Первая деталь, у которой есть СТОРОНА. В ящике два одинаковых
// диода, различающихся только полоской катода: перебор из двух пунктов, но
// перебирать тут нечего — на приборах сразу видно, что «неправильно» здесь
// значит «вообще ничего».

(() => {
  const L = Rig.rows({
    id: 't_diode',
    board: DB.s.board,
    supply: { id: 'SUP', name: 'Питание стенда', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.3,
    rows: [
      {
        id: 'BR', rated: 0.3,
        items: [
          {
            id: 'VD', kind: 'socket', name: 'Гнездо диода', silk: 'VD1',
            showValue: true, valueText: socketLabel, content: null,
            rated: { pMax: 1.5, tau: 1.0 },
            interact: {
              type: 'pick', title: 'Каким концом ставить диод',
              hint: 'Нажми, чтобы выбрать сторону',
              options: () => diodeOptions({ empty: true }),
            },
          },
          { id: 'HL1', kind: 'lamp', name: 'Контрольная лампа', silk: 'HL1', value: 47, showValue: true, rated: { pNom: 2.7, pMax: 6.0, tau: 1.2 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 't_diode',
    index: 11,
    title: 'В одну сторону',
    teaches: 'диод пропускает ток только в одну сторону',
    silk: 'STD-011',
    diag: 'СТЕНД · Сборка Т-11: гнездо диода пустое.',
    brief: 'В ящике два диода. Они совершенно одинаковые и отличаются только тем, с какой стороны на корпусе полоска. Поставь тот, при котором лампа загорится, и посмотри, сколько напряжения диод забирает себе.',
    lesson: 'Диод — деталь с направлением: в одну сторону он пропускает ток почти свободно, в другую не пропускает вообще. Сторону показывает полоска на корпусе: это тот конец, ИЗ которого ток выходить не может. Поставленный правильно, диод забирает себе примерно полвольта — это его собственная плата за проход, и она почти не зависит от тока. Поставленный наоборот, он ведёт себя как разрыв.',
    reveal: 'Пункт одиннадцатый: «Полоской к нагрузке. Я перепутал это дважды за двадцать лет, и оба раза долго искал, почему схема мёртвая, хотя всё целое».',
    hints: [
      'Поставь любой из двух и посмотри на ток. Если нуль — переставь другой.',
      'Полоска на корпусе — это выход диода. Ток входит с другой стороны.',
      'Обрати внимание на строку «На диоде»: правильно поставленный забирает себе около полувольта, неправильно — все двенадцать.',
    ],
    codex: ['diode', 'current', 'circuit', 'led'],
    vmax: 12.0,
    hold: 2.0,
    scale: DB.s.scale,
    board: DB.s.board,
    // Сторона диода — это топология, а не номинал: цепь надо пересобрать.
    topologyKey: (P) => (P.VD.content ? (P.VD.content.flipped ? 'r' : 'f') : 'x'),
    map: { pos: vec(-430, -920), radius: 900, color: hex(0x8fd88f), from: ['t_power', 't_short'], icon: { kind: 'diode' } },
    goalText: 'Поставь диод так, чтобы лампа загорелась.',
    scope: { label: 'Ток в ветке', get: (m) => m.i, min: 0, max: 0.35, band: [0.05, 0.35], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const i = Math.abs(sol.componentCurrent.HL1 || 0);
      const c = P.VD.content;
      return {
        i,
        empty: !c,
        back: !!c && !!c.flipped,
        uDiode: (sol.nodeVoltage.VCC || 0) - (sol.nodeVoltage.BR_1 || 0),
        uLamp: sol.nodeVoltage.BR_1 || 0,
        ok: i > 0.05,
      };
    },

    status(m) {
      if (m.empty) return ['Гнездо пустое — ветка разомкнута.', 'neutral'];
      if (m.ok) return ['Диод стоит правильно: ток идёт, а сам он забирает себе меньше вольта.', 'good'];
      return ['Диод стоит наоборот. В эту сторону он не пропускает ничего, и всё напряжение стоит на нём.', 'bad'];
    },

    goal(m) {
      if (m.empty) return { ok: false, note: 'Гнездо диода пустое.' };
      return { ok: m.ok, note: m.ok ? 'Ток ' + fmtAmps(m.i) : 'Диод заперт — тока нет' };
    },

    score(m) { return m.ok ? 1 : 0; },
    scoreNote(m) { return 'Ток ' + fmtAmps(m.i) + ', на самом диоде всего ' + fmtVolts(m.uDiode); },

    meter(m) {
      return [
        ['Ток в ветке', fmtAmps(m.i), m.ok ? 'good' : (m.empty ? '' : 'bad')],
        ['На диоде', m.empty ? '—' : fmtVolts(m.uDiode), m.back ? 'bad' : ''],
        ['На лампе', m.empty ? '—' : fmtVolts(m.uLamp)],
        ['Диод', m.empty ? 'не поставлен' : (m.back ? 'заперт' : 'открыт'), m.ok ? 'good' : 'warn'],
      ];
    },
  }));
})();
