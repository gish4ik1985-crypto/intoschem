'use strict';
// Т-09 · Короткое замыкание. Единственная сборка стенда, где игрока прямо
// приглашают сделать неправильно: перемычка стоит в списке первой, и она
// действительно замыкает ветку накоротко. Предохранитель для того тут и
// поставлен — учиться на этом безопаснее, чем на чужой плате.

(() => {
  const L = Rig.rows({
    id: 't_short',
    board: DB.m.board,
    supply: { id: 'SUP', name: 'Питание стенда', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.6,
    rows: [
      {
        id: 'BR', rated: 0.6,
        items: [
          {
            id: 'FU', kind: 'fuse', name: 'Предохранитель стенда', silk: 'FU1',
            value: 0.4, blown: false, label: '400 мА',
            showValue: true, valueText: (p) => (p.blown ? 'сгорел' : '400 мА'),
            interact: {
              type: 'pick', title: 'Предохранитель', hint: 'Нажми, чтобы поставить новый',
              options: () => [{ label: 'новый, 400 мА', note: 'заменить', value: 0.4, blown: false }],
            },
          },
          deckSocket('R1', 'Гнездо балласта', { silk: 'R1', title: 'Что поставить в гнездо', jumper: true, rated: { pMax: 3.0, tau: 1.0 } }),
          { id: 'HL1', kind: 'lamp', name: 'Контрольная лампа', silk: 'HL1', value: 22, showValue: true, rated: { pNom: 0.66, pMax: 4.0, tau: 1.2 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 't_short',
    index: 9,
    title: 'Короткое замыкание',
    teaches: 'перемычка вместо детали · предохранитель',
    silk: 'STD-009',
    diag: 'СТЕНД · Сборка Т-09: гнездо балласта пустое.',
    brief: 'Ветке нужно 172 миллиампера. В ящике, кроме резисторов, лежит перемычка — попробуй сначала её, специально: предохранитель на 400 миллиампер стоит здесь как раз для этого. Потом поставь то, что нужно на самом деле.',
    lesson: 'Перемычка — это ноль ом. Поставленная вместо детали, она убирает из ветки всё, что ограничивало ток, и его начинает ограничивать только внутреннее сопротивление самого источника — а его почти нет. Это и есть короткое замыкание: ток вырастает в разы, греется всё подряд. Предохранитель — деталь, которая нарочно сделана самой слабой в цепи: он сгорает первым и рвёт кольцо, пока не сгорело что-то дороже.',
    reveal: 'Пункт девятый: «Предохранители в ящике справа. Их много. Я их не жалел и тебе не советую — они дешевле всего остального, что тут есть».',
    hints: [
      'Поставь перемычку и посмотри на ток. Предохранитель после этого придётся заменить — он для того и стоит.',
      'Заменить предохранитель можно, нажав на него.',
      'Двенадцать вольт делить на 0,172 ампера — это около семидесяти ом на всю ветку. Лампа уже занимает двадцать два.',
    ],
    codex: ['short', 'fuse', 'resistor', 'ohm', 'wire'],
    vmax: 12.0,
    hold: 2.0,
    scale: DB.m.scale,
    board: DB.m.board,
    map: { pos: vec(-215, -1085), radius: 900, color: hex(0xff5b3d), from: ['t_switch', 't_divider'], icon: { kind: 'fuse' } },
    goalText: 'Ток 172 мА (допуск ±8%), предохранитель целый.',
    scope: { label: 'Ток в ветке', get: (m) => m.i, min: 0, max: 0.7, band: [0.158, 0.186], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    // Предохранитель перегорает от тока, а не от нагрева: у него это и есть
    // работа. Порог — его собственный номинал.
    tick(dt, P, m) {
      if (!P.FU.blown && Math.abs(m.i) > P.FU.value) P.FU.blown = true;
    },

    read(sol, refs, P) {
      const i = Math.abs(sol.componentCurrent.HL1 || 0);
      const jumper = !!P.R1.content && P.R1.content.kind === 'jumper';
      return {
        i, jumper,
        blown: !!P.FU.blown,
        empty: !P.R1.content,
        r: P.R1.content && P.R1.content.value ? P.R1.content.value : 0,
        uRes: (sol.nodeVoltage.BR_1 || 0) - (sol.nodeVoltage.BR_2 || 0),
        ok: !P.FU.blown && inPct(i, 0.172, 0.08),
      };
    },

    status(m) {
      if (m.blown) return ['Предохранитель сгорел — ток был выше его номинала. Нажми на него, чтобы поставить новый.', 'bad'];
      if (m.empty) return ['Гнездо пустое — ветка разомкнута.', 'neutral'];
      if (m.jumper) return ['В гнезде перемычка: ветку замкнуло накоротко, ограничивать ток нечем.', 'bad'];
      if (m.ok) return ['Сто семьдесят два миллиампера, предохранитель держит спокойно.', 'good'];
      if (m.i > 0.186) return ['Тока многовато: балласт слишком мал.', 'warn'];
      return ['Тока маловато: балласт слишком велик.', 'warn'];
    },

    goal(m) {
      if (m.blown) return { ok: false, note: 'Предохранитель сгорел — поставь новый.' };
      return { ok: m.ok, note: 'В ветке ' + fmtAmps(m.i) + ', нужно 172 мА' };
    },

    score(m) { return m.blown ? 0 : bandScore(m.i, 0.172, 0.08); },
    scoreNote(m) { return 'В гнезде ' + fmtOhms(m.r) + ', ток ' + fmtAmps(m.i) + ' — предохранитель на 400 мА даже не заметил'; },

    meter(m) {
      return [
        ['Ток в ветке', fmtAmps(m.i), m.ok ? 'good' : (m.jumper ? 'bad' : 'warn')],
        ['Предохранитель', m.blown ? 'сгорел' : 'цел · 400 мА', m.blown ? 'bad' : 'good'],
        ['В гнезде', m.empty ? 'пусто' : (m.jumper ? 'перемычка' : fmtOhms(m.r))],
        ['На балласте', m.empty || m.jumper ? '—' : fmtVolts(m.uRes)],
        ['Нужно', '172 мА'],
      ];
    },
  }));
})();
