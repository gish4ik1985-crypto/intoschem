'use strict';
// Ж-02 · Два ввода разного напряжения на одну шину. Соединить их напрямую
// нельзя: тот, что выше, начнёт гнать ток в того, что ниже, — сосед получит
// зарядку вместо нагрузки. Развязывают диодами: каждый ввод пропускает ток
// только наружу. Основной ввод узел роняет сам, раз в две секунды, — иначе
// проверить резерв нечем.

(() => {
  const L = Rig.rows({
    id: 'u_bridge',
    board: DB.xl.board,
    busX: { BUS: 0.72 },
    rated: 0.5,
    feeds: [
      { id: 'INA', tag: 'ввод от Ж-01', name: 'Основной ввод (от Ж-01)', label: '12 В', silk: 'XT1', value: 12, rInt: SUPPLY_R.BENCH },
      { id: 'INB', tag: 'ввод от Е-14', name: 'Резервный ввод (от Е-14)', label: '9 В', silk: 'XT2', value: 9, rInt: SUPPLY_R.BENCH },
    ],
    rows: [
      {
        id: 'FA', from: 'INA', to: 'BUS', rated: 0.5,
        items: [
          { id: 'SA1', kind: 'toggle', name: 'Основной ввод (пропадает сам)', silk: 'SA1', closed: true },
          { id: 'LA', kind: 'device', name: 'Кабель основного ввода', silk: 'W1', label: 'кабель', value: 2, showValue: true, rated: { pMax: 4.0, tau: 1.5 } },
          {
            id: 'VD1', kind: 'socket', name: 'Развязка основного ввода', silk: 'VD1',
            showValue: true, valueText: socketLabel, content: null, rated: { pMax: 2.0, tau: 1.0 },
            interact: {
              type: 'pick', title: 'Чем развязать основной ввод',
              hint: 'Нажми, чтобы выбрать', options: () => diodeOptions({ empty: true, jumper: true }),
            },
          },
        ],
      },
      {
        id: 'FB', from: 'INB', to: 'BUS', rated: 0.5,
        items: [
          { id: 'LB', kind: 'device', name: 'Кабель резервного ввода', silk: 'W2', label: 'кабель', value: 2, showValue: true, rated: { pMax: 4.0, tau: 1.5 } },
          {
            id: 'VD2', kind: 'socket', name: 'Развязка резервного ввода', silk: 'VD2',
            showValue: true, valueText: socketLabel, content: null, rated: { pMax: 2.0, tau: 1.0 },
            interact: {
              type: 'pick', title: 'Чем развязать резервный ввод',
              hint: 'Нажми, чтобы выбрать', options: () => diodeOptions({ empty: true, jumper: true }),
            },
          },
        ],
      },
      {
        id: 'LD', from: 'BUS', rated: 0.5,
        items: [{ id: 'RL', kind: 'device', name: 'Нагрузка узла', silk: 'A1', label: 'нагрузка', value: 33, showValue: true, rated: { pMax: 8.0, tau: 1.5 } }],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'u_bridge',
    index: 79,
    title: 'Основной и резервный',
    teaches: 'диодная развязка двух вводов',
    silk: 'BRG-2IN-79',
    diag: 'ДИАГНОСТИКА · Узел Ж-02: основной ввод пропадает, резервный не подхватывает.',
    brief: 'К узлу подведены два кабеля от разных соседей: основной на двенадцать вольт и резервный на девять. Основной пропадает сам, раз в две секунды — смотри на ленту. Нужно: пока оба на месте, нагрузка берёт не меньше 300 мА; когда основной пропал — не меньше 200 мА; и в резервный ввод ни при каких условиях не должно уходить больше 5 мА.',
    lesson: 'Два источника разного напряжения, соединённые напрямую, работают друг на друга: тот, что выше, гонит ток в того, что ниже, — и сосед вместо помощи получает зарядку, а кабель греется впустую. Разделяет их диод: он пропускает ток только наружу, из ввода в шину, и запирается, когда шина оказывается выше самого ввода. Тогда резервный ввод просто ждёт, ничего не отдавая, и вступает в тот момент, когда основной пропал и шина просела ниже него. Это и есть самое дешёвое резервирование питания, какое бывает.',
    reveal: 'Точка схода двух контуров. Резервный кабель протянут поверх остальных и закреплён наспех — его тянули уже после того, как основной начал пропадать.',
    hints: [
      'Поставь сначала перемычки в оба гнезда и посмотри на строку «Уходит в резерв».',
      'Диод пропускает ток только в одну сторону. Полоска на корпусе — тот конец, из которого ток выйти не может.',
      'Резервный ввод обязан быть заперт, пока шина выше девяти вольт, и открыться, когда она просядет ниже.',
    ],
    codex: ['diode', 'battery', 'current', 'circuit', 'ohm'],
    vmax: 12.0,
    hold: 2.5,
    testSeconds: 9,
    scale: DB.xl.scale,
    board: DB.xl.board,
    topologyKey: (P) => ['VD1', 'VD2'].map((id) => {
      const c = P[id].content;
      return c ? (c.kind === 'jumper' ? 'j' : (c.flipped ? 'r' : 'f')) : 'x';
    }).join(''),
    map: { pos: vec(215, 1180), radius: 900, color: hex(0xff8a4a), from: ['u_share', 'e_light'], icon: { kind: 'diode' } },
    goalText: 'С обоими вводами ≥300 мА, без основного ≥200 мА, в резерв ≤5 мА.',
    scope: { label: 'Ток нагрузки', get: (m) => m.iL, min: 0, max: 0.5, band: [0.2, 0.5], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    // Основной ввод роняем сами: проверять резерв, не отключая основной,
    // нечем — он бы просто никогда не вступил.
    tick(dt, P, m) {
      P.SA1.t = (P.SA1.t || 0) + dt;
      const on = (P.SA1.t % 4) < 2;
      P.SA1.closed = on;
      // Замер держится до следующего такого же: условие победы должно
      // существовать всё время, а не долю секунды в конце фазы.
      if (on) { P.SA1.iBoth = m.iL; P.SA1.backBoth = m.back; }
      else { P.SA1.iSolo = m.iL; P.SA1.backSolo = m.back; }
    },

    read(sol, refs, P) {
      const iL = Math.abs(sol.componentCurrent.RL || 0);
      const vBus = sol.nodeVoltage.BUS || 0;
      const vInB = sol.nodeVoltage.INB || 0;
      // Направление берём из напряжений, а не из знака тока: у перевёрнутого
      // диода знак свой, и по нему легко решить, что ток идёт не туда.
      const back = vBus > vInB ? Math.abs(sol.componentCurrent.VD2 || 0) : 0;
      const iBoth = P.SA1.iBoth === undefined ? 0 : P.SA1.iBoth;
      const iSolo = P.SA1.iSolo === undefined ? 0 : P.SA1.iSolo;
      const backMax = Math.max(P.SA1.backBoth || 0, P.SA1.backSolo || 0);
      return {
        iL, vBus, back, iBoth, iSolo, backMax,
        on: !!P.SA1.closed,
        ok: iBoth >= 0.3 && iSolo >= 0.2 && backMax <= 0.005,
      };
    },

    status(m) {
      if (m.ok) return ['Основной питает, резервный ждёт заперт и подхватывает, когда основной пропадает.', 'good'];
      if (m.backMax > 0.005) return ['В резервный ввод уходит ' + fmtAmps(m.backMax) + ': основной работает на него вместо нагрузки.', 'bad'];
      if (m.iSolo < 0.2) return ['Без основного ввода нагрузке не хватает: резервный не подхватывает.', 'warn'];
      if (m.iBoth < 0.3) return ['С обоими вводами нагрузке не хватает: основной не доходит до шины.', 'warn'];
      return ['Подожди полный цикл: основной ввод пропадает и возвращается сам.', 'neutral'];
    },

    goal(m) {
      if (m.backMax > 0.005) return { ok: false, note: 'В резерв уходит ' + fmtAmps(m.backMax) + ', разрешено 5 мА' };
      if (m.iBoth < 0.3) return { ok: false, note: 'С обоими вводами ' + fmtAmps(m.iBoth) + ', нужно 300 мА' };
      return { ok: m.iSolo >= 0.2, note: 'Без основного ' + fmtAmps(m.iSolo) + ', нужно 200 мА' };
    },

    score(m) { return m.ok ? clamp(0.6 + (m.iSolo - 0.2) * 2, 0.6, 1) : 0; },
    scoreNote(m) { return 'С обоими ' + fmtAmps(m.iBoth) + ', на одном резерве ' + fmtAmps(m.iSolo) + ', встречный ток ' + fmtAmps(m.backMax); },

    meter(m) {
      return [
        ['Ток нагрузки', fmtAmps(m.iL), m.iL >= 0.2 ? 'good' : 'warn'],
        ['Основной ввод', m.on ? 'на месте' : 'пропал', m.on ? 'good' : 'warn'],
        ['Уходит в резерв', fmtAmps(m.back), m.back > 0.005 ? 'bad' : 'good'],
        ['С обоими вводами', m.iBoth ? fmtAmps(m.iBoth) : '—', m.iBoth >= 0.3 ? 'good' : ''],
        ['На одном резерве', m.iSolo ? fmtAmps(m.iSolo) : '—', m.iSolo >= 0.2 ? 'good' : ''],
        ['Напряжение шины', fmtVolts(m.vBus)],
      ];
    },
  }));
})();
