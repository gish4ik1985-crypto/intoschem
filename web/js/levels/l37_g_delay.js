'use strict';
// Г-04 · Задержка. Первый узел, где настраивают не величину, а ВРЕМЯ. Считать
// его нечем, кроме сопротивления и ёмкости: больше любого из двух — дольше
// ждать, и зависимость ровно прямая.

(() => {
  const L = Rig.rows({
    id: 'g_delay',
    board: DB.m.board,
    busX: { CAP: 0.62 },
    supply: { id: 'SUP', name: 'Ввод узла', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.06,
    rows: [
      {
        id: 'CH', to: 'CAP', rated: 0.06,
        items: [
          deckToggle('SA1', 'Ключ пуска отсчёта', false, 'Нажми, чтобы начать отсчёт заново'),
          deckSocket('R0', 'Гнездо задающего', { silk: 'R0', title: 'Что задаёт время', jumper: false, rated: { pMax: 2.0, tau: 1.0 } }),
        ],
      },
      {
        id: 'CP', from: 'CAP', rated: 0.06,
        items: [{ id: 'C1', kind: 'capacitor', name: 'Задающая ёмкость', silk: 'C1', value: 4700e-6, vMax: 16, label: '4700 мкФ' }],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'g_delay',
    index: 51,
    title: 'Выдержка времени',
    teaches: 'сопротивление и ёмкость задают время',
    silk: 'DLY-470-37',
    diag: 'ДИАГНОСТИКА · Узел Г-04: выдержка не выставлена, гнездо задающего пустое.',
    brief: 'Узел должен выдавать сигнал не сразу, а с выдержкой: напряжение на задающей ёмкости обязано дойти до восьми вольт не раньше чем через две секунды и не позже четырёх. Ёмкость запаяна наглухо — 4700 мкФ. Меняют только то, через что она набирается.',
    lesson: 'Конденсатор набирается не мгновенно, и скорость задают ровно две вещи: его собственная ёмкость и сопротивление, через которое он заряжается. Их произведение и есть характерное время: за него напряжение проходит примерно две трети пути до конца. Никакого отдельного «таймера» тут нет — время получается само, из сопротивления и ёмкости.',
    reveal: 'Выдержка перед пуском. Она давала команде время отойти от люка. Судя по журналу, срабатывала она в последний раз одновременно с сигналом тревоги.',
    hints: [
      'Замкни ключ и смотри на ленту: видно, как напряжение подбирается к восьми вольтам.',
      'Разомкнутый ключ сбрасывает отсчёт — ёмкость разряжается, и можно пробовать заново.',
      'Характерное время — это сопротивление, умноженное на ёмкость. До восьми вольт из двенадцати уходит примерно одно такое время с небольшим.',
    ],
    codex: ['capacitor', 'rc', 'resistor', 'ohm'],
    vmax: 12.0,
    hold: 1.5,
    // Узел настраивается во времени: перебору состояний нужно дать
    // прожить дольше выдержки, иначе он не увидит ни одного попадания.
    testSeconds: 7,
    scale: DB.m.scale,
    board: DB.m.board,
    map: { pos: vec(-967, 250), radius: 900, color: hex(0x8fd0ff), from: ['g_latch', 'b_inrush'], icon: { kind: 'capacitor', value: 4700e-6 } },
    goalText: 'Восемь вольт на ёмкости — через 2…4 секунды после пуска.',
    scope: { label: 'Напряжение на ёмкости', get: (m) => m.uCap, min: 0, max: 12, band: [8, 12], fmt: fmtVolts },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    // Разомкнутый ключ сбрасывает отсчёт и разряжает ёмкость. Напряжение
    // конденсатора входит в правую часть, которая пересобирается каждый шаг,
    // — метки топологии это не требует (см. CLAUDE.md, «Решатель»).
    tick(dt, P, m, refs) {
      if (!P.SA1.closed) {
        if (refs.C1) refs.C1.vPrev = 0;
        P.C1.since = 0;
        P.C1.hit = 0;
        return;
      }
      P.C1.since = (P.C1.since || 0) + dt;
      if (!P.C1.hit && m.uCap >= 8) P.C1.hit = P.C1.since;
    },

    read(sol, refs, P) {
      const uCap = sol.nodeVoltage.CAP || 0;
      const hit = P.C1.hit || 0;
      return {
        uCap,
        since: P.C1.since || 0,
        hit,
        running: !!P.SA1.closed,
        empty: !P.R0.content,
        ok: hit >= 2.0 && hit <= 4.0,
      };
    },

    status(m) {
      if (m.empty) return ['Гнездо задающего пустое — ёмкость не набирается вообще.', 'neutral'];
      if (!m.running) return ['Ключ разомкнут, отсчёт сброшен. Замкни его и засеки время.', 'neutral'];
      if (m.ok) return ['Восемь вольт набралось за ' + fmtSeconds(m.hit) + '. Выдержка в допуске.', 'good'];
      if (m.hit && m.hit < 2) return ['Слишком быстро: ' + fmtSeconds(m.hit) + '. Задающее сопротивление мало.', 'warn'];
      if (m.hit) return ['Слишком долго: ' + fmtSeconds(m.hit) + '. Задающее сопротивление велико.', 'warn'];
      return ['Набирается… ' + fmtVolts(m.uCap) + ' из восьми, прошло ' + fmtSeconds(m.since) + '.', 'warn'];
    },

    goal(m) {
      if (!m.running) return { ok: false, note: 'Отсчёт не запущен.' };
      if (!m.hit) return { ok: false, note: 'Восьми вольт ещё нет: ' + fmtVolts(m.uCap) + ' за ' + fmtSeconds(m.since) };
      return { ok: m.ok, note: 'Выдержка ' + fmtSeconds(m.hit) + ', нужно от 2 до 4 секунд' };
    },

    score(m) { return m.ok ? bandScore(m.hit, 3.0, 0.34) : 0; },
    scoreNote(m) { return 'Выдержка ' + fmtSeconds(m.hit) + ' — её задают только сопротивление и ёмкость'; },

    meter(m) {
      return [
        ['На ёмкости', fmtVolts(m.uCap)],
        ['Прошло с пуска', fmtSeconds(m.since)],
        ['Выдержка', m.hit ? fmtSeconds(m.hit) : '—', m.ok ? 'good' : (m.hit ? 'warn' : '')],
        ['Нужно', 'от 2 до 4 с'],
      ];
    },
  }));
})();
