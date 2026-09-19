'use strict';
// В-08 · Калибровка. Итоговый узел сектора: тут одновременно и подстройка
// рукой, и прибор, который сам является нагрузкой. Ни одно из двух по
// отдельности уже не новость — новость в том, что они мешают друг другу.

(() => {
  const L = Rig.rows({
    id: 'v_cal',
    board: DB.l.board,
    busX: { OUT: 0.46 },
    supply: { id: 'SUP', name: 'Ввод тракта', label: '12 В', silk: 'G1', value: 12 },
    rows: [
      {
        id: 'TOP', to: 'OUT', rated: 0.02,
        items: [{
          id: 'RP', kind: 'pot', name: 'Подстройка опоры', silk: 'RP',
          value: 2400, knob: 0, rated: { pMax: 1.0, tau: 1.0 },
          interact: {
            type: 'knob', hint: 'Крути колесом мыши или тяни вверх-вниз',
            map: (k) => Math.round(lerp(2400, 200, clamp(k, 0, 1))),
          },
        }],
      },
      {
        id: 'BOT', from: 'OUT', rated: 0.02,
        items: [{ id: 'R2', kind: 'resistor', name: 'Нижнее плечо', silk: 'R2', value: 470, showValue: true, rated: { pMax: 1.0, tau: 1.0 } }],
      },
      {
        id: 'PV', from: 'OUT', rated: 0.002,
        items: [{ id: 'PV1', kind: 'device', name: 'Вход измерителя', silk: 'PV1', value: 10000, rated: { pMax: 1.0, tau: 1.0 } }],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'v_cal',
    index: 47,
    title: 'Калибровка опоры',
    teaches: 'прибор — тоже нагрузка',
    silk: 'CAL-330-33',
    diag: 'ДИАГНОСТИКА · Узел В-08: опора тракта не совпадает с эталонной.',
    brief: 'Эталон требует на выходе ровно 3,30 вольта. Верхнее плечо здесь подстроечное — его крутят. Нижнее запаяно наглухо: 470 ом. Параллельно нижнему плечу висит вход измерителя, и его десять килоом никуда не деть — он часть цепи, хочешь того или нет.',
    lesson: 'Вход прибора — это сопротивление, и оно встаёт параллельно тому плечу, к которому подключено. Считать делитель по паспортным номиналам плеч тут бесполезно: нижнее плечо на деле не 470 ом, а 470 параллельно с десятью килоомами. Поэтому калибруют не по расчёту, а по показанию: крутят и смотрят, пока не сойдётся.',
    reveal: 'Эталонная опора всего измерительного тракта. Дата последней калибровки совпадает с датой, после которой в журнале изделия не записано ничего.',
    hints: [
      'Тянуть ручку мышью точнее, чем крутить колесом: колесо ходит крупными шагами.',
      'Нижнее плечо на деле меньше своих 470 ом: параллельно ему висит вход прибора.',
      'Не считай — калибруй. Крути и смотри на показание, пока не станет 3,30.',
    ],
    codex: ['divider', 'resistor', 'ohm', 'current'],
    vmax: 12.0,
    hold: 3.0,
    scale: DB.l.scale,
    board: DB.l.board,
    map: { pos: vec(-107, -135), radius: 900, color: hex(0x2fd4c8), from: ['v_shunt', 'b_reference'], icon: { kind: 'resistor', value: 1200 } },
    goalText: 'На выходе опоры — 3,30 В (допуск ±3%).',
    scope: { label: 'Опора тракта', get: (m) => m.out, min: 0, max: 6, band: [3.201, 3.399], fmt: fmtVolts },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const out = sol.nodeVoltage.OUT || 0;
      const iBot = Math.abs(sol.componentCurrent.R2 || 0);
      const iPv = Math.abs(sol.componentCurrent.PV1 || 0);
      return {
        out, iBot, iPv,
        rp: P.RP.value,
        // Нижнее плечо на деле — 470 параллельно входу прибора.
        rBot: (iBot + iPv) > 1e-9 ? out / (iBot + iPv) : NaN,
        ok: inPct(out, 3.3, 0.03),
      };
    },

    status(m) {
      if (m.ok) return ['Три и три десятых. Опора сведена с эталоном.', 'good'];
      if (m.out > 3.4) return ['Опора выше эталона — прибавь сопротивление верхнего плеча.', 'warn'];
      return ['Опора ниже эталона — убавь сопротивление верхнего плеча.', 'warn'];
    },

    goal(m) { return { ok: m.ok, note: 'На выходе ' + fmtVolts(m.out) + ', эталон 3,30 В' }; },

    score(m) { return bandScore(m.out, 3.3, 0.03); },
    scoreNote(m) { return 'Опора ' + fmtVolts(m.out) + ' при верхнем плече ' + fmtOhms(m.rp); },

    meter(m) {
      return [
        ['Опора', fmtVolts(m.out), m.ok ? 'good' : 'warn'],
        ['Верхнее плечо', fmtOhms(m.rp)],
        ['Нижнее плечо с прибором', fmtOhms(m.rBot)],
        ['Ток в приборе', fmtAmps(m.iPv)],
        ['Эталон', '3,30 В'],
      ];
    },
  }));
})();
