'use strict';
// Е-10 · Буфер шины. Третья роль конденсатора после «набирается» и «отдаёт
// всё разом»: он ДЕРЖИТ шину в те доли секунды, когда нагрузка дёргает ток.
// Импульс здесь короче кадра по ощущению, поэтому провал видно только на
// ленте самописца — и это часть урока.

(() => {
  const CAPS = [
    { label: '1000 мкФ', value: 1000e-6 },
    { label: '2200 мкФ', value: 2200e-6 },
    { label: '4700 мкФ', value: 4700e-6 },
  ];

  const L = Rig.rows({
    id: 'e_buffer',
    board: DB.xl.board,
    busX: { BUS: 0.45 },
    supply: { id: 'SUP', name: 'Ввод узла', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.3,
    rows: [
      {
        id: 'LN', to: 'BUS', rated: 0.3,
        items: [{ id: 'RL', kind: 'device', name: 'Сопротивление ввода', silk: 'RL', value: 22, showValue: true, rated: { pMax: 4.0, tau: 1.5 } }],
      },
      {
        id: 'CP', from: 'BUS', rated: 0.3,
        items: [
          {
            id: 'C1', kind: 'capacitor', name: 'Буфер шины', silk: 'C1',
            value: 1000e-6, vMax: 16, label: '1000 мкФ', showValue: true,
            valueText: (p) => (p.value * 1e6).toFixed(0) + ' мкФ',
            interact: {
              type: 'pick', title: 'Какую ёмкость поставить',
              hint: 'Нажми, чтобы выбрать ёмкость',
              options: () => CAPS.slice(),
            },
          },
        ],
      },
      {
        id: 'PL', from: 'BUS', rated: 0.3,
        items: [
          { id: 'SA2', kind: 'toggle', name: 'Импульсная нагрузка (щёлкает сама)', silk: 'SA2', closed: false },
          { id: 'D1', kind: 'device', name: 'Импульсный потребитель', silk: 'A1', value: 47, showValue: true, rated: { pMax: 4.0, tau: 1.5 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'e_buffer',
    index: 71,
    title: 'Буфер шины',
    teaches: 'конденсатор держит напряжение в провале',
    silk: 'BUF-470-71',
    diag: 'ДИАГНОСТИКА · Узел Е-10: шина проваливается на каждом импульсе.',
    brief: 'Потребитель на этой шине включается сам, короткими импульсами по десятой доле секунды. Ввод не идеальный — двадцать два ома, и на каждом импульсе шина проваливается. Паспорт требует, чтобы в провале на ней оставалось не меньше 8,8 вольта. Меняется только ёмкость буфера.',
    lesson: 'Конденсатор на шине работает запасом: в спокойное время он набирается до полного напряжения, а в момент броска отдаёт накопленное обратно в шину, пока источник не успевает. Насколько глубоко просядет шина, зависит от того, сколько заряда успеет уйти за время импульса, — то есть от ёмкости и от длительности броска. Больше ёмкость — мельче провал. Это и есть смысл банок, стоящих рядом с любым сильноточным потребителем.',
    reveal: 'Шина импульсного передатчика. Буфер на ней стоял самый большой из всех, что были на станции: передатчику давали выстрелить, даже когда на всё остальное уже не хватало.',
    hints: [
      'Смотри на ленту самописца: провал живёт десятую долю секунды и глазом почти не ловится.',
      'Чем больше ёмкость, тем меньше успевает измениться напряжение за то же время.',
      'Из трёх ёмкостей ящика подходит только самая большая — проверь остальные и убедись.',
    ],
    codex: ['capacitor', 'rc', 'ohm', 'current', 'power'],
    vmax: 12.0,
    hold: 2.5,
    testSeconds: 7,
    scale: DB.xl.scale,
    board: DB.xl.board,
    topologyKey: (P) => String(P.C1.value),
    map: { pos: vec(-430, 795), radius: 900, color: hex(0x8fd0ff), from: ['e_listen', 'e_leak'], icon: { kind: 'capacitor', value: 4700e-6 } },
    goalText: 'В провале на шине остаётся не меньше 8,8 В.',
    scope: { label: 'Напряжение шины', get: (m) => m.uBus, min: 6, max: 13, band: [8.8, 13], fmt: fmtVolts },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    // Потребитель включается сам: провал надо ловить внутри шагов решателя,
    // раз в кадр он просто не попадётся.
    tick(dt, P, m) {
      P.SA2.t = (P.SA2.t || 0) + dt;
      const on = (P.SA2.t % 1.2) < 0.1;
      if (on && !P.SA2.closed) P.SA2.run = 12;      // начало импульса
      P.SA2.closed = on;
      if (on) P.SA2.run = Math.min(P.SA2.run === undefined ? 12 : P.SA2.run, m.uBus);
      else if (P.SA2.run !== undefined) P.SA2.dip = P.SA2.run;
    },

    read(sol, refs, P) {
      const uBus = sol.nodeVoltage.BUS || 0;
      return {
        uBus,
        dip: P.SA2.dip,
        on: !!P.SA2.closed,
        i: Math.abs(sol.componentCurrent.D1 || 0),
        cap: P.C1.value,
        ok: P.SA2.dip !== undefined && P.SA2.dip >= 8.8,
      };
    },

    status(m) {
      if (m.dip === undefined) return ['Импульса ещё не было — подожди, потребитель включается сам.', 'neutral'];
      if (m.ok) return ['В провале шина держит ' + fmtVolts(m.dip) + '. Буфера хватает.', 'good'];
      return ['Шина проваливается до ' + fmtVolts(m.dip) + ' — буфер мал и не успевает подхватить.', 'warn'];
    },

    goal(m) {
      if (m.dip === undefined) return { ok: false, note: 'Импульса ещё не было.' };
      return { ok: m.ok, note: 'В провале ' + fmtVolts(m.dip) + ', нужно не ниже 8,8 В' };
    },

    score(m) { return m.ok ? clamp((m.dip - 8.0) / 1.3, 0, 1) : 0; },
    scoreNote(m) { return 'Буфер ' + (m.cap * 1e6).toFixed(0) + ' мкФ: в провале остаётся ' + fmtVolts(m.dip || 0); },

    meter(m) {
      return [
        ['Провал шины', m.dip === undefined ? '—' : fmtVolts(m.dip), m.ok ? 'good' : 'warn'],
        ['Напряжение сейчас', fmtVolts(m.uBus)],
        ['Импульс', m.on ? 'идёт' : 'пауза', m.on ? 'warn' : ''],
        ['Буфер', (m.cap * 1e6).toFixed(0) + ' мкФ'],
        ['Нужно', 'не ниже 8,8 В'],
      ];
    },
  }));
})();
