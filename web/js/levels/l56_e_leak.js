'use strict';
// Е-09 · Изоляция. Узел про то, что «не соединено» — это не бесконечность, а
// просто очень большое сопротивление, и оно падает, когда изоляция намокает.
//
// Четвёртый из шести отводов, которых нет на схеме. Он тут особенно к месту:
// одна утечка объяснена и стоит на плате открыто, вторая — нет.

(() => {
  const L = Rig.rows({
    id: 'e_leak',
    board: DB.l.board,
    busX: { OUT: 0.45 },
    supply: { id: 'SUP', name: 'Ввод узла', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.1,
    rows: [
      {
        id: 'SP', to: 'OUT', rated: 0.1,
        items: [deckSocket('R1', 'Гнездо развязки', { silk: 'R1', title: 'Что поставить в развязку', jumper: false, rated: { pMax: 1.0, tau: 1.0 } })],
      },
      {
        id: 'IZ', from: 'OUT', rated: 0.05,
        items: [{ id: 'RIZ', kind: 'device', name: 'Сопротивление изоляции', silk: 'RIZ', value: 560, showValue: true, rated: { pMax: 2.0, tau: 1.5 } }],
      },
      {
        id: 'SN', from: 'OUT', rated: 0.05,
        items: [{ id: 'D1', kind: 'device', name: 'Забортный датчик', silk: 'BQ1', value: 220, showValue: true, rated: { pMax: 2.0, tau: 1.5 } }],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'e_leak',
    index: 70,
    title: 'Изоляция',
    teaches: 'изоляция — это очень большое, но конечное сопротивление',
    silk: 'ISO-137-70',
    diag: 'ДИАГНОСТИКА · Узел Е-09: изоляция забортного кабеля отсырела, 560 Ом на корпус.',
    brief: 'Кабель к забортному датчику отсырел: его изоляция, вместо тысяч килоом, показывает 560 ом на корпус — то есть просто вторая ветка, которую ты не ставил. Убрать её нельзя. Нужно, чтобы через изоляцию шло не больше 7 мА, а датчик при этом получал не меньше 12 мА. Меняется только развязка на входе.',
    lesson: 'Изоляция — не «нет соединения», а сопротивление: очень большое, пока сухо, и вполне обычное, когда мокро. Как только оно становится сравнимым с полезной нагрузкой, ток начинает делиться между ними, как между любыми двумя параллельными ветками. Убрать утечку нельзя, но её можно ограничить: развязка на входе понижает напряжение в точке, а вместе с ним падает и ток по обеим веткам — и по паразитной, и по нужной. Поэтому номинал развязки ищут не по одному условию, а между двумя.',
    reveal: 'Шлейф забортных датчиков точки подъёма. По журналу вода стоит здесь давно, и датчики продолжали работать — просто половину тока отдавали в море.',
    hints: [
      'Изоляция и датчик висят на одной точке, значит делят её напряжение поровну и берут ток каждый по своему сопротивлению.',
      'Чем больше развязка, тем ниже напряжение в точке — падает и утечка, и полезный ток. Ищи между двумя условиями.',
      'Изоляция и датчик вместе дают около 158 ом. Прикинь, при каком напряжении в точке оба условия сходятся, и посчитай развязку от него.',
    ],
    codex: ['ohm', 'series', 'current', 'resistor'],
    vmax: 12.0,
    hold: 2.5,
    scale: DB.l.scale,
    board: DB.l.board,
    map: { pos: vec(-215, 795), radius: 900, color: hex(0x8fd0ff), from: ['e_polarity', 'e_highside'], icon: { kind: 'device', value: 560 } },
    goalText: 'Утечка не больше 7 мА, ток датчика не меньше 12 мА.',
    scope: { label: 'Ток утечки', get: (m) => m.iIz, min: 0, max: 0.03, band: [0, 0.007], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => { const refs = Rig.build(c, P); addSecretTap(c, 'e_leak'); return refs; },
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const iIz = Math.abs(sol.componentCurrent.RIZ || 0);
      const iS = Math.abs(sol.componentCurrent.D1 || 0);
      const leak = Math.abs(sol.componentCurrent.TAP || 0);
      const empty = !P.R1.content;
      return {
        iIz: empty ? 0 : iIz,
        iS: empty ? 0 : iS,
        leak,
        uOut: empty ? NaN : (sol.nodeVoltage.OUT || 0),
        empty,
        r: P.R1.content ? P.R1.content.value : 0,
        ok: !empty && iIz <= 0.007 && iS >= 0.012,
      };
    },

    status(m) {
      if (m.empty) return ['Гнездо развязки пустое — шлейф обесточен целиком.', 'neutral'];
      if (m.ok) return ['Утечка укладывается, датчику хватает. Обе ветки в норме.', 'good'];
      if (m.iIz > 0.007) return ['Через изоляцию уходит слишком много: напряжение в точке высоковато, развязка мала.', 'warn'];
      return ['Датчику не хватает тока: развязка слишком велика, точка просела.', 'warn'];
    },

    goal(m) {
      if (m.empty) return { ok: false, note: 'Развязка не поставлена.' };
      if (m.iIz > 0.007) return { ok: false, note: 'Утечка ' + fmtAmps(m.iIz) + ', разрешено 7 мА' };
      return { ok: m.iS >= 0.012, note: 'Датчик берёт ' + fmtAmps(m.iS) + ', нужно не меньше 12 мА' };
    },

    score(m) { return m.ok ? clamp(1 - (m.iIz / 0.007) * 0.35, 0, 1) : 0; },
    scoreNote(m) { return 'Развязка ' + fmtOhms(m.r) + ': в море уходит ' + fmtAmps(m.iIz) + ', датчику достаётся ' + fmtAmps(m.iS); },

    meter(m) {
      return [
        ['Ток утечки', m.empty ? '—' : fmtAmps(m.iIz), m.iIz <= 0.007 && !m.empty ? 'good' : 'warn'],
        ['Ток датчика', m.empty ? '—' : fmtAmps(m.iS), m.iS >= 0.012 ? 'good' : 'warn'],
        ['В точке шлейфа', m.empty ? '—' : fmtVolts(m.uOut)],
        tapRow(m.leak),
        ['Нужно', 'утечка ≤7 мА, датчик ≥12 мА'],
      ];
    },
  }));
})();
