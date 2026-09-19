'use strict';
// В-06 · Утечка. Первый узел сектора, где ничего не надо подбирать — надо
// найти. Снаружи три контура выглядят одинаково, и какой из них лишний,
// говорит только прибор.

(() => {
  const L = Rig.rows({
    id: 'v_leak',
    board: DB.l.board,
    supply: { id: 'SUP', name: 'Ввод тракта', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.2,
    rows: [
      {
        id: 'C1', rated: 0.08,
        items: [
          deckToggle('SA1', 'Ключ первого контура', true, 'Нажми, чтобы отключить или подключить контур'),
          { id: 'D1', kind: 'device', name: 'Контур 1', silk: 'A1', value: 220, rated: { pMax: 2.0, tau: 1.2 } },
        ],
      },
      {
        id: 'C2', rated: 0.08,
        items: [
          deckToggle('SA2', 'Ключ второго контура', true, 'Нажми, чтобы отключить или подключить контур'),
          { id: 'D2', kind: 'device', name: 'Контур 2', silk: 'A2', value: 470, rated: { pMax: 2.0, tau: 1.2 } },
        ],
      },
      {
        id: 'C3', rated: 0.08,
        items: [
          deckToggle('SA3', 'Ключ третьего контура', true, 'Нажми, чтобы отключить или подключить контур'),
          { id: 'D3', kind: 'device', name: 'Контур 3', silk: 'A3', value: 150, rated: { pMax: 2.0, tau: 1.2 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'v_leak',
    index: 45,
    title: 'Лишний ток',
    teaches: 'диагностика по току ветки',
    silk: 'LEK-080-31',
    diag: 'ДИАГНОСТИКА · Узел В-06: потребление вдвое выше расчётного, причина не локализована.',
    brief: 'Три контура на одной шине. По паспорту первый берёт 55 мА, второй 25, третий 20 — вместе 100 мА, а тракт тянет вдвое больше. Первые два обязаны остаться в работе. Снаружи все три выглядят одинаково.',
    lesson: 'Ток ветки говорит о её сопротивлении и больше ни о чём. Если ветка берёт вчетверо больше положенного, значит её сопротивление вчетверо меньше паспортного — изоляция где-то пробита, и часть тока уходит мимо полезной работы. Найти такую ветку можно, не вскрывая ни одной: достаточно померить каждую по очереди и сравнить с паспортом.',
    reveal: 'Шлейф внешних датчиков. Третий контур уходил наружу корпуса — там, где по журналу давно стоит вода.',
    hints: [
      'Отключай контуры по одному и смотри, как меняется общий ток тракта.',
      'Паспорт: 55, 25 и 20 миллиампер. Разница между паспортом и измеренным и есть утечка.',
      'Лишний контур надо не настроить, а отключить. Два первых при этом обязаны остаться в работе.',
    ],
    codex: ['current', 'ohm', 'circuit', 'short', 'wire'],
    vmax: 12.0,
    hold: 2.5,
    scale: DB.l.scale,
    board: DB.l.board,
    map: { pos: vec(323, -135), radius: 900, color: hex(0xffd166), from: ['v_trim', 'v_match'], icon: { kind: 'device' } },
    goalText: 'Оставить в работе оба нужных контура и увести общий ток ниже 90 мА.',
    scope: { label: 'Общий ток тракта', get: (m) => m.total, min: 0, max: 0.25, band: [0, 0.09], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const i1 = Math.abs(sol.componentCurrent.D1 || 0);
      const i2 = Math.abs(sol.componentCurrent.D2 || 0);
      const i3 = Math.abs(sol.componentCurrent.D3 || 0);
      const total = i1 + i2 + i3;
      return {
        i1, i2, i3, total,
        ok1: inPct(i1, 0.0545, 0.12),
        ok2: inPct(i2, 0.0255, 0.12),
        under: total <= 0.09,
      };
    },

    status(m) {
      if (m.under && m.ok1 && m.ok2) return ['Потребление в норме, и оба нужных контура работают. Лишний найден и отключён.', 'good'];
      if (!m.ok1 || !m.ok2) return ['Один из нужных контуров обесточен. Отключать надо не любой — а тот, что берёт лишнее.', 'warn'];
      return ['Тракт тянет ' + fmtAmps(m.total) + ' вместо ста миллиампер. Отключай по одному и смотри на общий ток.', 'warn'];
    },

    goal(m) {
      if (!m.ok1 || !m.ok2) return { ok: false, note: 'Оба нужных контура должны остаться под током.' };
      return { ok: m.under, note: 'Тракт берёт ' + fmtAmps(m.total) + ', допустимо 90 мА' };
    },

    score(m) { return (m.ok1 && m.ok2 && m.under) ? clamp(1 - (m.total - 0.08) / 0.05, 0.6, 1) : 0; },
    scoreNote(m) { return 'Тракт берёт ' + fmtAmps(m.total) + ' — ровно столько, сколько просит паспорт'; },

    meter(m) {
      return [
        ['Контур 1 (норма 55 мА)', fmtAmps(m.i1), m.ok1 ? 'good' : 'warn'],
        ['Контур 2 (норма 25 мА)', fmtAmps(m.i2), m.ok2 ? 'good' : 'warn'],
        ['Контур 3 (норма 20 мА)', fmtAmps(m.i3), m.i3 > 0.03 ? 'bad' : 'good'],
        ['Всего', fmtAmps(m.total), m.under ? 'good' : 'bad'],
        ['Допустимо', '90 мА'],
      ];
    },
  }));
})();
