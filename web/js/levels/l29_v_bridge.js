'use strict';
// В-04 · Мост. Самый красивый приём измерительной техники: неизвестное
// сопротивление находят не измерением, а СРАВНЕНИЕМ — и результат не зависит
// ни от напряжения питания, ни от его просадки.

(() => {
  const L = Rig.rows({
    id: 'v_bridge',
    board: DB.xl.board,
    busX: { NA: 0.34, NB: 0.64 },
    supply: { id: 'SUP', name: 'Питание моста', label: '12 В', silk: 'G1', value: 12 },
    rows: [
      {
        id: 'A1', to: 'NA', rated: 0.2,
        items: [deckSocket('R1', 'Верхнее плечо образца', { silk: 'R1', title: 'Верхнее плечо образцовой ветви', jumper: false, rated: { pMax: 2.0, tau: 1.0 } })],
      },
      {
        id: 'A2', from: 'NA', rated: 0.2,
        items: [deckSocket('R2', 'Нижнее плечо образца', { silk: 'R2', title: 'Нижнее плечо образцовой ветви', jumper: false, rated: { pMax: 2.0, tau: 1.0 } })],
      },
      {
        id: 'B1', to: 'NB', rated: 0.1,
        items: [{ id: 'RX', kind: 'device', name: 'Неизвестное сопротивление', silk: 'RX', value: 150, rated: { pMax: 2.0, tau: 1.0 } }],
      },
      {
        id: 'B2', from: 'NB', rated: 0.1,
        items: [{ id: 'R3', kind: 'resistor', name: 'Образцовое плечо', silk: 'R3', value: 100, showValue: true, rated: { pMax: 2.0, tau: 1.0 } }],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'v_bridge',
    index: 43,
    title: 'Измерительный мост',
    teaches: 'сравнение вместо измерения',
    silk: 'BRG-150-29',
    diag: 'ДИАГНОСТИКА · Узел В-04: мост разбалансирован, номинал RX не читается.',
    brief: 'В узле запаяно сопротивление без маркировки. Рядом — образцовая ветвь: два гнезда и известные сто ом. Мост считается сведённым, когда середины обеих ветвей имеют ОДИНАКОВЫЙ потенциал: разница не больше двадцати милливольт.',
    lesson: 'Обе ветви висят на одном и том же напряжении, поэтому их середины совпадут ровно тогда, когда совпадут ОТНОШЕНИЯ плеч. Это и есть суть моста: неизвестное находят не измерением, а сравнением с известным, и ответ не зависит ни от питания, ни от его просадки — только от отношения. Поэтому мост сводится одинаково и на тридцати трёх с двадцатью двумя, и на ста пятидесяти со ста.',
    reveal: 'Эталонный мост измерительного тракта. Неизвестное сопротивление оказалось не деталью, а датчиком — им изделие мерило что-то снаружи корпуса.',
    hints: [
      'Наведи курсор на обе середины: важна не их величина, а разница между ними.',
      'Мост сводится, когда отношение верхнего плеча к нижнему одинаково в обеих ветвях.',
      'В правой ветви внизу сто ом. Подбери левую пару так, чтобы её отношение совпало — и прочитай RX как R1, умноженное на сто и делённое на R2.',
    ],
    codex: ['divider', 'ohm', 'resistor', 'series'],
    vmax: 12.0,
    hold: 3.0,
    scale: DB.xl.scale,
    board: DB.xl.board,
    map: { pos: vec(538, -300), radius: 900, color: hex(0x6ee7a8), from: ['v_trim', 'fuse_box'], icon: { kind: 'resistor', value: 150 } },
    goalText: 'Свести мост: разница середин не больше 20 мВ.',
    scope: { label: 'Разбаланс моста', get: (m) => m.diff, min: -3, max: 3, band: [-0.02, 0.02], fmt: fmtVolts },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const a = sol.nodeVoltage.NA || 0;
      const b = sol.nodeVoltage.NB || 0;
      const r1 = P.R1.content ? P.R1.content.value : NaN;
      const r2 = P.R2.content ? P.R2.content.value : NaN;
      const built = !!P.R1.content && !!P.R2.content;
      return {
        // Пока хоть одно гнездо образцовой ветви пустое, её середина ни к
        // чему не подключена, и «напряжение» на ней — утечка решателя, а не
        // показание. Честнее прочерк, чем правдоподобное число.
        a: built ? a : NaN,
        b, diff: built ? a - b : NaN, r1, r2, built,
        rx: isBadNum(r1) || isBadNum(r2) ? NaN : (r1 * 100) / r2,
        empty: !P.R1.content || !P.R2.content,
        ok: !!P.R1.content && !!P.R2.content && Math.abs(a - b) <= 0.02,
      };
    },

    status(m) {
      if (m.empty) return ['Образцовая ветвь не собрана — сравнивать не с чем.', 'neutral'];
      if (m.ok) return ['Мост сведён. Отношения плеч совпали — значит RX равен ' + fmtOhms(m.rx) + '.', 'good'];
      if (isBadNum(m.diff)) return ['Образцовая ветвь не собрана — сравнивать не с чем.', 'neutral'];
      if (m.diff > 0) return ['Левая середина выше правой: нижнее плечо образца великовато относительно верхнего.', 'warn'];
      return ['Левая середина ниже правой: нижнее плечо образца маловато относительно верхнего.', 'warn'];
    },

    goal(m) {
      if (m.empty) return { ok: false, note: 'Образцовая ветвь не собрана.' };
      return { ok: m.ok, note: 'Разбаланс ' + fmtVolts(m.diff) + ', допустимо 20 мВ' };
    },

    score(m) { return m.empty ? 0 : clamp(1 - Math.abs(m.diff) / 0.045, 0, 1); },
    scoreNote(m) { return 'Мост сведён — неизвестное сопротивление оказалось ' + fmtOhms(m.rx); },

    meter(m) {
      return [
        ['Середина образца', fmtVolts(m.a)],
        ['Середина с RX', fmtVolts(m.b)],
        ['Разбаланс', fmtVolts(m.diff), m.ok ? 'good' : (m.built ? 'warn' : '')],
        ['Отношение образца', isBadNum(m.r1 / m.r2) ? '—' : trimNum(m.r1 / m.r2, 2)],
        ['RX по мосту', m.ok ? fmtOhms(m.rx) : '—', m.ok ? 'good' : ''],
      ];
    },
  }));
})();
