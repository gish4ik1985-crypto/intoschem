'use strict';
// Е-04 · Выровнять две ветки. Задача не «получить ток», а «получить ОДИНАКОВЫЙ
// ток в двух разных ветках» — а ветки разные по устройству. Отсюда и правило:
// делят они не поровну, а обратно пропорционально сопротивлению, и равенство
// приходится делать руками.

(() => {
  const L = Rig.rows({
    id: 'e_share',
    board: DB.m.board,
    supply: { id: 'SUP', name: 'Ввод узла', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.3,
    rows: [
      {
        id: 'A', rated: 0.2,
        items: [{ id: 'D1', kind: 'device', name: 'Левый нагреватель', silk: 'EK1', value: 100, showValue: true, rated: { pMax: 4.0, tau: 1.5 } }],
      },
      {
        id: 'B', rated: 0.2,
        items: [
          deckSocket('R1', 'Гнездо выравнивания', { silk: 'R1', title: 'Чем выровнять ветки', jumper: false, rated: { pMax: 2.0, tau: 1.0 } }),
          { id: 'D2', kind: 'device', name: 'Правый нагреватель', silk: 'EK2', value: 68, showValue: true, rated: { pMax: 4.0, tau: 1.5 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'e_share',
    index: 65,
    title: 'Поровну на двоих',
    teaches: 'параллельные ветки делят ток по сопротивлению',
    silk: 'SHR-119-65',
    diag: 'ДИАГНОСТИКА · Узел Е-04: нагреватели греют неравномерно.',
    brief: 'Два нагревателя на одной шине должны брать одинаковый ток — иначе одна сторона греется, а другая нет. Но сами они разные: слева сто ом, справа шестьдесят восемь. Выровняй ветки гнездом в правой, чтобы токи отличались не больше чем на 5%, и каждая брала не меньше 100 мА.',
    lesson: 'Параллельные ветки получают одинаковое напряжение, а ток берут обратно пропорционально своему сопротивлению: у кого меньше ом, тот берёт больше. Поэтому две неодинаковые ветки никогда не делят нагрузку поровну сами по себе — их выравнивают, добавляя недостающее сопротивление той, которой его не хватает. Ровно так и делают в реальном железе, когда одинаковой мощности надо добиться от неодинаковых по сопротивлению нагрузок.',
    reveal: 'Обогрев смотрового люка. Два контура: один под стеклом, второй по ободу. Их выровняли когда-то вручную, а потом кто-то вынул выравнивающий резистор — и с тех пор обод примерзал.',
    hints: [
      'Посмотри, какая ветка сейчас берёт больше. Именно ей и надо добавить сопротивления.',
      'Токи сравняются, когда сравняются полные сопротивления веток.',
      'Слева ровно сто ом. Справа уже есть шестьдесят восемь — сколько не хватает до ста?',
    ],
    codex: ['series', 'ohm', 'current', 'resistor', 'power'],
    vmax: 12.0,
    hold: 2.5,
    scale: DB.m.scale,
    board: DB.m.board,
    map: { pos: vec(215, 630), radius: 900, color: hex(0xff8a4a), from: 'e_bleed', icon: { kind: 'device', value: 100 } },
    goalText: 'Токи веток отличаются не больше чем на 5%, и каждый не меньше 100 мА.',
    scope: { label: 'Разница токов', get: (m) => m.diff, min: 0, max: 0.4, band: [0, 0.05], fmt: (v) => Math.round(v * 100) + '%' },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const iA = Math.abs(sol.componentCurrent.D1 || 0);
      const iB = Math.abs(sol.componentCurrent.D2 || 0);
      const diff = Math.max(iA, iB) > 1e-6 ? Math.abs(iA - iB) / Math.max(iA, iB) : 1;
      return {
        iA, iB, diff,
        empty: !P.R1.content,
        r: P.R1.content ? P.R1.content.value : 0,
        vcc: sol.nodeVoltage.VCC || 0,
        ok: diff <= 0.05 && iA >= 0.1 && iB >= 0.1,
      };
    },

    status(m) {
      if (m.empty) return ['Правая ветка разомкнута: весь ток берёт левая.', 'neutral'];
      if (m.ok) return ['Ветки выровнены: разница меньше пяти процентов.', 'good'];
      if (m.iB > m.iA) return ['Правая берёт больше левой — ей не хватает сопротивления.', 'warn'];
      return ['Правая берёт меньше левой — сопротивления ей добавили с запасом.', 'warn'];
    },

    goal(m) {
      if (m.empty) return { ok: false, note: 'Правая ветка разомкнута.' };
      if (m.iA < 0.1 || m.iB < 0.1) return { ok: false, note: 'Каждая ветка должна брать не меньше 100 мА' };
      return { ok: m.ok, note: 'Разница ' + Math.round(m.diff * 100) + '%, разрешено 5%' };
    },

    score(m) { return m.ok ? clamp(1 - (m.diff / 0.05) * 0.45, 0, 1) : 0; },
    scoreNote(m) { return 'Слева ' + fmtAmps(m.iA) + ', справа ' + fmtAmps(m.iB) + ' — разница ' + Math.round(m.diff * 100) + '%'; },

    meter(m) {
      return [
        ['Разница токов', Math.round(m.diff * 100) + '%', m.ok ? 'good' : 'warn'],
        ['Левая ветка', fmtAmps(m.iA)],
        ['Правая ветка', m.empty ? '—' : fmtAmps(m.iB)],
        ['В гнезде', m.empty ? 'пусто' : fmtOhms(m.r)],
        ['Напряжение шины', fmtVolts(m.vcc)],
      ];
    },
  }));
})();
