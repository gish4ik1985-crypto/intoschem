'use strict';
// Е-12 · Предохранитель по току. На стенде предохранитель просто стоял и
// сгорал; здесь его надо ВЫБРАТЬ, а выбор зажат с двух сторон: он обязан
// пережить пусковой ток и обязан быть слабее проводки.

(() => {
  const RATINGS = [
    { label: '200 мА', value: 0.2, blown: false },
    { label: '500 мА', value: 0.5, blown: false },
    { label: '1 А', value: 1.0, blown: false },
  ];

  const L = Rig.rows({
    id: 'e_fuse',
    board: DB.l.board,
    busX: { BUS: 0.4 },
    supply: { id: 'SUP', name: 'Ввод узла', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.6,
    rows: [
      {
        id: 'IN', to: 'BUS', rated: 0.6,
        items: [
          {
            id: 'FU', kind: 'fuse', name: 'Предохранитель ввода', silk: 'FU1',
            value: 0.2, blown: false, showValue: true,
            valueText: (p) => (p.blown ? 'сгорел' : (p.value >= 1 ? '1 А' : Math.round(p.value * 1000) + ' мА')),
            interact: {
              type: 'pick', title: 'Какой предохранитель поставить',
              hint: 'Нажми, чтобы выбрать номинал',
              options: () => RATINGS.slice(),
            },
          },
        ],
      },
      {
        id: 'WK', from: 'BUS', rated: 0.3,
        items: [{ id: 'HL1', kind: 'lamp', name: 'Рабочая нагрузка', silk: 'HL1', value: 47, showValue: true, rated: { pNom: 3.0, pMax: 6.0, tau: 1.2 } }],
      },
      {
        id: 'ST', from: 'BUS', rated: 0.3,
        items: [
          {
            id: 'SB1', kind: 'button', name: 'Кнопка пуска', silk: 'SB1', closed: false,
            interact: { type: 'press', hint: 'Нажми и держи — это пусковой режим' },
          },
          { id: 'M1', kind: 'motor', name: 'Пусковая обмотка', silk: 'M1', value: 68, rated: { iNom: 0.18, pMax: 4.0, tau: 1.5 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'e_fuse',
    index: 73,
    title: 'Предохранитель по току',
    teaches: 'номинал защиты выбирают между двумя границами',
    silk: 'FUS-500-73',
    diag: 'ДИАГНОСТИКА · Узел Е-12: защита ввода срабатывает при каждом пуске.',
    brief: 'В рабочем режиме узел берёт около 250 мА, при нажатой кнопке пуска — почти вдвое больше. Проводка ввода рассчитана на 500 мА, поэтому ставить защиту крупнее нельзя. Нажми и подержи кнопку пуска: предохранитель должен это пережить.',
    lesson: 'Предохранитель выбирают не «на всякий случай побольше» и не «поточнее по рабочему току». Снизу его зажимает самый большой ТОК НОРМАЛЬНОЙ РАБОТЫ — а это обычно не рабочий режим, а пуск, когда потребитель на секунду берёт вдвое-втрое больше. Сверху его зажимает то, что он защищает: провод, разъём, дорожка. Предохранитель обязан быть самым слабым звеном в цепи — если он крупнее проводки, то сгорит проводка, а он останется цел, и вся защита окажется бессмысленной.',
    reveal: 'Ввод привода шлюза. В держателе найден предохранитель на два ампера с самодельной пометкой: «чтобы не выбивало». Проводка под ним обуглена по всей длине.',
    hints: [
      'Сначала посмотри рабочий ток, потом нажми кнопку пуска и посмотри пусковой.',
      'Защита обязана пережить пуск: её номинал должен быть больше пускового тока.',
      'И одновременно не больше 500 мА — иначе она перестанет защищать проводку.',
    ],
    codex: ['fuse', 'current', 'short', 'power', 'circuit'],
    vmax: 12.0,
    hold: 2.0,
    scale: DB.l.scale,
    board: DB.l.board,
    map: { pos: vec(-215, 960), radius: 900, color: hex(0xff5b3d), from: ['e_leak', 'e_charge'], icon: { kind: 'fuse' } },
    goalText: 'Держи пуск: защита цела, её номинал не больше 500 мА.',
    scope: { label: 'Ток ввода', get: (m) => m.total, min: 0, max: 0.8, band: [0.3, 0.5], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    tick(dt, P, m) {
      if (!P.FU.blown && m.total > P.FU.value) P.FU.blown = true;
    },

    read(sol, refs, P) {
      const iW = Math.abs(sol.componentCurrent.HL1 || 0);
      const iS = Math.abs(sol.componentCurrent.M1 || 0);
      return {
        iW, iS,
        total: iW + iS,
        rating: P.FU.value,
        blown: !!P.FU.blown,
        start: !!P.SB1.closed,
        ok: !P.FU.blown && !!P.SB1.closed && P.FU.value <= 0.5 && (iW + iS) > 0.3,
      };
    },

    status(m) {
      if (m.blown) return ['Предохранитель сгорел на пуске — его номинал меньше пускового тока. Поставь следующий.', 'bad'];
      if (m.rating > 0.5) return ['Такой номинал переживёт что угодно, включая пожар в проводке: он крупнее того, что защищает.', 'bad'];
      if (!m.start) return ['Рабочий режим держится. Нажми и подержи кнопку пуска — проверяется именно он.', 'neutral'];
      return ['Пусковой ток ' + fmtAmps(m.total) + ', защита держит и при этом слабее проводки.', 'good'];
    },

    goal(m) {
      if (m.blown) return { ok: false, note: 'Предохранитель сгорел — номинал мал.' };
      if (m.rating > 0.5) return { ok: false, note: 'Номинал ' + Math.round(m.rating * 1000) + ' мА больше разрешённых 500 мА' };
      if (!m.start) return { ok: false, note: 'Нажми и подержи кнопку пуска.' };
      return { ok: m.ok, note: 'Пусковой ток ' + fmtAmps(m.total) + ', защита цела' };
    },

    score(m) { return m.ok ? 1 : 0; },
    scoreNote(m) { return 'Защита на ' + Math.round(m.rating * 1000) + ' мА держит пусковые ' + fmtAmps(m.total); },

    meter(m) {
      return [
        ['Ток ввода', fmtAmps(m.total), m.blown ? 'bad' : (m.start ? 'warn' : '')],
        ['Рабочая ветка', fmtAmps(m.iW)],
        ['Пусковая ветка', fmtAmps(m.iS)],
        ['Предохранитель', m.blown ? 'сгорел' : (m.rating >= 1 ? '1 А' : Math.round(m.rating * 1000) + ' мА'), m.blown ? 'bad' : (m.rating <= 0.5 ? 'good' : 'bad')],
        ['Проводка держит', '500 мА'],
      ];
    },
  }));
})();
