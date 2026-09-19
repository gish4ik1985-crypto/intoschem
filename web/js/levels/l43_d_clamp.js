'use strict';
// Д-03 · Стабилизация на диодах. Первый узел, где напряжение задаёт не
// отношение сопротивлений, а сама деталь: диод держит своё падение почти
// независимо от тока, и это можно использовать как опору.

(() => {
  const L = Rig.rows({
    id: 'd_clamp',
    board: DB.m.board,
    busX: { CL: 0.45 },
    supply: { id: 'SUP', name: 'Ввод ядра', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.05,
    rows: [
      {
        id: 'BA', to: 'CL', rated: 0.05,
        items: [deckSocket('R0', 'Задающий балласт', { silk: 'R0', title: 'Через что питать опору', jumper: false, rated: { pMax: 2.0, tau: 1.0 } })],
      },
      {
        id: 'DD', from: 'CL', rated: 0.05,
        items: [
          { id: 'VD1', kind: 'diode', name: 'Первый диод опоры', silk: 'VD1' },
          { id: 'VD2', kind: 'diode', name: 'Второй диод опоры', silk: 'VD2' },
        ],
      },
      {
        id: 'LD', from: 'CL', rated: 0.02,
        items: [{ id: 'LD1', kind: 'device', name: 'Потребитель опоры', silk: 'RL', value: 150, rated: { pMax: 1.0, tau: 1.0 } }],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'd_clamp',
    index: 57,
    title: 'Опора на диодах',
    teaches: 'диод держит своё падение',
    silk: 'CLM-121-43',
    diag: 'ДИАГНОСТИКА · Узел Д-03: опора на диодах не питается, гнездо балласта пустое.',
    brief: 'Опора на два диода подряд должна давать от 1,15 до 1,30 вольта, и через сами диоды должно идти от 8 до 30 миллиампер: меньше — опора «плывёт», больше — диоды греются впустую. Гнездо балласта пустое, потребитель на 150 ом подключён.',
    lesson: 'У диода ток растёт от напряжения не пропорционально, а обвально: чтобы удвоить ток, хватает лишних двух сотых вольта. Поэтому напряжение на открытом диоде почти не зависит от того, сколько через него идёт — на этом и строят простейшую опору. Балласт тут задаёт не напряжение, а ТОК: напряжение задают сами диоды. Ток нужен достаточный, чтобы опора держалась, и не больший — лишний уходит в тепло.',
    reveal: 'Опора порогового узла. К ней приведены все решения, которые изделие принимало само, без человека.',
    hints: [
      'Наведи курсор на диоды: посмотри, сколько вольт на каждом и сколько тока через них.',
      'Балласт задаёт общий ток. Часть его забирает потребитель, остальное идёт через диоды.',
      'Через диоды нужно от 8 до 30 мА. Потребитель на 150 ом при 1,2 В берёт около восьми — значит балласт должен пропускать около двадцати с небольшим.',
    ],
    codex: ['diode', 'ohm', 'resistor', 'current', 'divider'],
    vmax: 12.0,
    hold: 2.5,
    scale: DB.m.scale,
    board: DB.m.board,
    map: { pos: vec(323, 100), radius: 900, color: hex(0x6ee7a8), from: ['d_cascade', 'v_leak'], icon: { kind: 'diode' } },
    goalText: 'Опора 1,15…1,30 В при токе диодов 8…30 мА.',
    scope: { label: 'Напряжение опоры', get: (m) => m.u, min: 0, max: 2, band: [1.15, 1.30], fmt: fmtVolts },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const u = sol.nodeVoltage.CL || 0;
      const iD = Math.abs(sol.componentCurrent.VD1 || 0);
      const iL = Math.abs(sol.componentCurrent.LD1 || 0);
      return {
        u, iD, iL,
        iTotal: Math.abs(sol.componentCurrent.R0 || 0),
        empty: !P.R0.content,
        uOk: u >= 1.15 && u <= 1.30,
        iOk: iD >= 0.008 && iD <= 0.030,
      };
    },

    status(m) {
      if (m.empty) return ['Гнездо балласта пустое — опора не питается.', 'neutral'];
      if (m.uOk && m.iOk) return ['Опора держится, и ток через диоды в рабочем окне.', 'good'];
      if (m.iD < 0.008) return ['Через диоды всего ' + fmtAmps(m.iD) + ' — опора на таком токе плывёт: балласт слишком велик.', 'warn'];
      if (m.iD > 0.030) return ['Через диоды ' + fmtAmps(m.iD) + ' — лишнее уходит в тепло: балласт слишком мал.', 'warn'];
      return ['Опора ' + fmtVolts(m.u) + ' вне допуска.', 'warn'];
    },

    goal(m) {
      if (m.empty) return { ok: false, note: 'Балласт не поставлен.' };
      if (!m.iOk) return { ok: false, note: 'Ток диодов ' + fmtAmps(m.iD) + ', нужно 8…30 мА' };
      return { ok: m.uOk, note: 'Опора ' + fmtVolts(m.u) + ', нужно 1,15…1,30 В' };
    },

    score(m) { return (m.uOk && m.iOk) ? bandScore(m.u, 1.225, 0.062) : 0; },
    scoreNote(m) { return 'Опора ' + fmtVolts(m.u) + ' при токе диодов ' + fmtAmps(m.iD) + ' — её держат сами диоды, а не расчёт'; },

    meter(m) {
      return [
        ['Опора', fmtVolts(m.u), m.uOk ? 'good' : 'warn'],
        ['Через диоды', fmtAmps(m.iD), m.iOk ? 'good' : 'warn'],
        ['В потребителе', fmtAmps(m.iL)],
        ['Через балласт', fmtAmps(m.iTotal)],
        ['Нужно', '1,15…1,30 В · 8…30 мА'],
      ];
    },
  }));
})();
