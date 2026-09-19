'use strict';
// В-01 · Шунт. Ток нельзя увидеть напрямую — можно только пустить его через
// известное сопротивление и померить падение. Весь фокус в том, каким это
// сопротивление должно быть: слишком маленькое ничего не покажет, слишком
// большое само станет частью цепи и испортит то, что мерит.

(() => {
  const SHUNT_KIT = [0.1, 0.22, 0.47, 1, 2.2, 4.7, 10];
  const L = Rig.rows({
    id: 'v_shunt',
    board: DB.s.board,
    supply: { id: 'SUP', name: 'Ввод тракта', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.3,
    rows: [
      {
        id: 'M', rated: 0.3,
        items: [
          deckSocket('RS', 'Гнездо шунта', { silk: 'RS', title: 'Что поставить шунтом', jumper: false, kit: SHUNT_KIT, rated: { pMax: 2.0, tau: 1.0 } }),
          { id: 'LD', kind: 'device', name: 'Контролируемая нагрузка', silk: 'RL', value: 47, rated: { pMax: 6.0, tau: 1.5 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'v_shunt',
    index: 40,
    title: 'Токовый шунт',
    teaches: 'ток мерят падением напряжения',
    silk: 'SHT-100-26',
    diag: 'ДИАГНОСТИКА · Узел В-01: шунт вынут, ток тракта не измеряется.',
    brief: 'Узел должен показывать ток нагрузки. Прямо ток измерить нечем — измеряется всегда напряжение. Паспорт узла требует, чтобы на шунте было от 50 до 120 мВ: меньше не разобрать на фоне помех, больше — и шунт сам начинает мешать нагрузке.',
    lesson: 'Прибор всегда измеряет напряжение. Чтобы узнать ток, его пропускают через известное маленькое сопротивление и меряют падение на нём — дальше закон Ома. Шунт делают маленьким нарочно: он вставлен последовательно в рабочую цепь, и всё, что на нём осталось, отобрано у нагрузки.',
    reveal: 'Токовый датчик магистрали. По его записям видно, что потребление изделия падало ступенями — узел за узлом, а не разом.',
    hints: [
      'Наведи курсор на шунт: там видно и ток через него, и падение на нём.',
      'Падение на шунте — это его сопротивление, умноженное на ток нагрузки. Ток тут около четверти ампера.',
      'Нужно от 50 до 120 мВ. Четверть ампера на 0,22 ома — это 55 мВ; на 0,47 — почти 120.',
    ],
    codex: ['ohm', 'current', 'resistor', 'wire'],
    vmax: 12.0,
    hold: 2.5,
    scale: DB.s.scale,
    board: DB.s.board,
    map: { pos: vec(-107, -300), radius: 900, color: hex(0x2fd4c8), from: ['switchboard', 'heater'], icon: { kind: 'resistor', value: 0.47 } },
    goalText: 'Падение на шунте — от 50 до 120 мВ.',
    scope: { label: 'Падение на шунте', get: (m) => m.uShunt, min: 0, max: 0.3, band: [0.05, 0.12], fmt: fmtVolts },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const i = Math.abs(sol.componentCurrent.LD || 0);
      const uShunt = P.RS.content ? (sol.nodeVoltage.VCC || 0) - (sol.nodeVoltage.M_1 || 0) : NaN;
      return {
        i, uShunt,
        uLoad: sol.nodeVoltage.M_1 || 0,
        empty: !P.RS.content,
        ok: !!P.RS.content && uShunt >= 0.05 && uShunt <= 0.12,
      };
    },

    status(m) {
      if (m.empty) return ['Гнездо шунта пустое — цепь разомкнута, мерить нечего.', 'neutral'];
      if (m.ok) return ['Падение на шунте в рабочем окне: ток читается, и нагрузке это не мешает.', 'good'];
      if (m.uShunt < 0.05) return ['На шунте слишком мало: такое падение не отличить от помехи.', 'warn'];
      return ['На шунте слишком много: он уже сам заметно отбирает у нагрузки.', 'warn'];
    },

    goal(m) {
      if (m.empty) return { ok: false, note: 'Шунт не поставлен.' };
      return { ok: m.ok, note: 'На шунте ' + fmtVolts(m.uShunt) + ', нужно от 50 до 120 мВ' };
    },

    score(m) { return m.empty ? 0 : bandScore(m.uShunt, 0.085, 0.41); },
    scoreNote(m) { return 'Падение ' + fmtVolts(m.uShunt) + ' при токе ' + fmtAmps(m.i) + ' — по нему ток и считается'; },

    meter(m) {
      return [
        ['Падение на шунте', fmtVolts(m.uShunt), m.ok ? 'good' : 'warn'],
        ['Ток тракта', fmtAmps(m.i)],
        ['На нагрузке', fmtVolts(m.uLoad)],
        ['Рабочее окно', '50…120 мВ'],
      ];
    },
  }));
})();
