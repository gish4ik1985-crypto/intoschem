'use strict';
// Ж-01 · Первый узел, у которого НЕТ своего источника. Питание к нему тянут
// кабелями от двух соседей, и весь урок в том, что две линии от разных мест —
// это две параллельные ветки: ток они делят не поровну, а обратно
// пропорционально своему сопротивлению. Чтобы делили поровну, короткую линию
// приходится догружать.

(() => {
  const L = Rig.rows({
    id: 'u_share',
    board: DB.xl.board,
    busX: { BUS: 0.55 },
    rated: 0.6,
    // Своего источника нет вообще. Вместо него — два клеммника ввода на
    // кромке платы: питание и земля приходят кабелями от соседних узлов.
    feeds: [
      { id: 'INA', tag: 'ввод от Е-15', name: 'Ввод от соседнего узла Е-15', label: '12 В', silk: 'XT1', value: 12, rInt: SUPPLY_R.BENCH },
      { id: 'INB', tag: 'ввод от Е-14', name: 'Ввод от соседнего узла Е-14', label: '12 В', silk: 'XT2', value: 12, rInt: SUPPLY_R.BENCH },
    ],
    rows: [
      {
        id: 'FA', from: 'INA', to: 'BUS', rated: 0.4,
        items: [
          { id: 'LA', kind: 'device', name: 'Кабель от Е-15 (короткий)', silk: 'W1', label: 'кабель', value: 2, showValue: true, rated: { pMax: 4.0, tau: 1.5 } },
          deckSocket('R1', 'Гнездо догрузки', { silk: 'R1', title: 'Что добавить в короткую линию', jumper: true, rated: { pMax: 3.0, tau: 1.0 } }),
        ],
      },
      {
        id: 'FB', from: 'INB', to: 'BUS', rated: 0.4,
        items: [
          { id: 'LB', kind: 'device', name: 'Кабель от Е-14 (длинный)', silk: 'W2', label: 'кабель', value: 12, showValue: true, rated: { pMax: 4.0, tau: 1.5 } },
        ],
      },
      {
        id: 'LD', from: 'BUS', rated: 0.6,
        items: [{ id: 'RL', kind: 'device', name: 'Нагрузка узла', silk: 'A1', label: 'нагрузка', value: 20, showValue: true, rated: { pMax: 10.0, tau: 1.5 } }],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'u_share',
    index: 78,
    title: 'Питание с двух сторон',
    teaches: 'две линии делят ток по своему сопротивлению',
    silk: 'SHR-2IN-78',
    diag: 'ДИАГНОСТИКА · Узел Ж-01: своего питания нет, оба ввода перегружают короткий кабель.',
    brief: 'У этого узла нет своего источника: питание к нему тянут кабелями от двух соседей. Кабели разной длины — два ома и двенадцать. Нужно, чтобы вводы отдавали поровну (разница не больше 5%), а нагрузка брала не меньше 400 мА.',
    lesson: 'Два кабеля от разных соседей — это две обычные параллельные ветки, и ток они делят обратно пропорционально сопротивлению: короткий кабель отдаёт в разы больше длинного, и сосед на его конце проседает первым. Выравнивают это добавочным сопротивлением в КОРОТКУЮ линию — так, чтобы обе ветки имели одинаковое полное сопротивление. Земля при этом общая: она приходит теми же кабелями и садится на общий обратный провод, иначе току просто некуда возвращаться.',
    reveal: 'Перемычка между двумя контурами. Её ставили вручную, наспех: узел рассчитан на собственный ввод, а собственного ввода у него больше нет.',
    hints: [
      'Посмотри на токи обоих вводов: короткий кабель отдаёт заметно больше.',
      'Токи сравняются, когда сравняются полные сопротивления двух линий.',
      'Длинная линия — двенадцать ом. Короткая — два. Сколько не хватает короткой?',
    ],
    codex: ['series', 'ohm', 'current', 'wire', 'ground'],
    vmax: 12.0,
    hold: 2.5,
    scale: DB.xl.scale,
    board: DB.xl.board,
    map: { pos: vec(430, 1180), radius: 900, color: hex(0x8fd0ff), from: ['e_budget', 'e_light'], icon: { kind: 'feed', label: '12 В' } },
    goalText: 'Вводы отдают поровну (разница ≤5%), нагрузка берёт ≥400 мА.',
    scope: { label: 'Разница токов вводов', get: (m) => m.diff, min: 0, max: 1, band: [0, 0.05], fmt: (v) => Math.round(v * 100) + '%' },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const iA = Math.abs(sol.componentCurrent.LA || 0);
      const iB = Math.abs(sol.componentCurrent.LB || 0);
      const iL = Math.abs(sol.componentCurrent.RL || 0);
      const diff = Math.max(iA, iB) > 1e-6 ? Math.abs(iA - iB) / Math.max(iA, iB) : 1;
      return {
        iA, iB, iL, diff,
        bus: sol.nodeVoltage.BUS || 0,
        empty: !P.R1.content,
        r: P.R1.content && P.R1.content.value ? P.R1.content.value : 0,
        jumper: !!P.R1.content && P.R1.content.kind === 'jumper',
        ok: diff <= 0.05 && iL >= 0.4,
      };
    },

    status(m) {
      if (m.empty) return ['Гнездо догрузки пустое: короткая линия разомкнута, весь ток тянет длинная.', 'neutral'];
      if (m.ok) return ['Вводы отдают поровну, нагрузке хватает. Оба соседа просядут одинаково — то есть почти никак.', 'good'];
      if (m.iL < 0.4) return ['Нагрузке не хватает тока: догрузка слишком велика, обе линии просели.', 'warn'];
      if (m.iA > m.iB) return ['Короткий кабель отдаёт больше длинного — ему не хватает добавочного сопротивления.', 'warn'];
      return ['Короткий кабель отдаёт меньше длинного: добавочного поставлено с запасом.', 'warn'];
    },

    goal(m) {
      if (m.empty) return { ok: false, note: 'Короткая линия разомкнута.' };
      if (m.iL < 0.4) return { ok: false, note: 'Нагрузка берёт ' + fmtAmps(m.iL) + ', нужно не меньше 400 мА' };
      return { ok: m.ok, note: 'Разница вводов ' + Math.round(m.diff * 100) + '%, разрешено 5%' };
    },

    score(m) { return m.ok ? clamp(1 - (m.diff / 0.05) * 0.45, 0, 1) : 0; },
    scoreNote(m) { return 'Ближний ввод ' + fmtAmps(m.iA) + ', дальний ' + fmtAmps(m.iB) + ' — разница ' + Math.round(m.diff * 100) + '%'; },

    meter(m) {
      return [
        ['Разница вводов', Math.round(m.diff * 100) + '%', m.ok ? 'good' : 'warn'],
        ['Ввод от Е-15', fmtAmps(m.iA)],
        ['Ввод от Е-14', fmtAmps(m.iB)],
        ['Нагрузка', fmtAmps(m.iL), m.iL >= 0.4 ? 'good' : 'warn'],
        ['Напряжение узла', fmtVolts(m.bus)],
      ];
    },
  }));
})();
