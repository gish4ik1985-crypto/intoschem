'use strict';
// В-03 · Подстройка. Первый узел, где номинал не выбирают из ящика, а
// крутят рукой. Ощущение «чуть-чуть не туда» здесь — часть урока: между
// соседними положениями ручки лежат десятки миллиампер.

(() => {
  const L = Rig.rows({
    id: 'v_trim',
    board: DB.s.board,
    supply: { id: 'SUP', name: 'Ввод узла', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.4,
    rows: [
      {
        id: 'TR', rated: 0.3,
        items: [
          {
            id: 'RP', kind: 'pot', name: 'Подстроечное сопротивление', silk: 'RP',
            value: 120, knob: 0,
            rated: { pMax: 3.0, tau: 1.2 },
            interact: {
              type: 'knob', hint: 'Крути колесом мыши или тяни вверх-вниз',
              map: (k) => Math.round(lerp(120, 2, clamp(k, 0, 1))),
            },
          },
          { id: 'HL1', kind: 'lamp', name: 'Осветитель', silk: 'HL1', value: 30, rated: { pNom: 1.9, pMax: 6.0, tau: 1.0 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'v_trim',
    index: 42,
    title: 'Подстройка накала',
    teaches: 'плавная регулировка тока',
    silk: 'TRM-250-28',
    diag: 'ДИАГНОСТИКА · Узел В-03: накал осветителя выкручен в минимум.',
    brief: 'Здесь резистор с ручкой. Крути её, пока лампа не засветит как надо.',
    lesson: 'Резистор с ручкой — тот же резистор, только его можно плавно менять рукой. Так регулируют громкость и яркость.',
    reveal: 'Подсветка приёмного окна. Она работала на минимуме — кто-то убавил её до предела, но не выключил. На минимуме её не видно снаружи.',
    hints: [
      'Крути колесом мыши над ручкой или тяни её вверх-вниз мышью.',
      'Тянуть мышью точнее, чем крутить колесом: колесо ходит крупными шагами.',
      'Ток великоват — крути в сторону большего сопротивления.',
    ],
    codex: ['ohm', 'resistor', 'current', 'lamp'],
    vmax: 12.0,
    hold: 2.5,
    scale: DB.s.scale,
    board: DB.s.board,
    map: { pos: vec(323, -300), radius: 900, color: hex(0xffc46b), from: ['v_scale', 'fuse_box'], icon: { kind: 'lamp' } },
    goalText: 'Ток лампы — 250 мА.',
    scope: { label: 'Ток осветителя', get: (m) => m.i, min: 0, max: 0.45, band: [0.235, 0.265], fmt: fmtAmps },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      const i = Math.abs(sol.componentCurrent.HL1 || 0);
      const uLamp = sol.nodeVoltage.TR_1 || 0;
      return {
        i, uLamp,
        rp: P.RP.value,
        uPot: (sol.nodeVoltage.VCC || 0) - uLamp,
        pPot: Math.abs(((sol.nodeVoltage.VCC || 0) - uLamp) * i),
        ok: inPct(i, 0.25, 0.06),
      };
    },

    status(m) {
      if (m.ok) return ['Двести пятьдесят миллиампер. Осветитель в паспортном режиме.', 'good'];
      if (m.i > 0.265) return ['Ток великоват — убавь: сопротивление ручки слишком мало.', 'warn'];
      return ['Ток маловат — прибавь: сопротивление ручки слишком велико.', 'warn'];
    },

    goal(m) { return { ok: m.ok, note: 'Ток ' + fmtAmps(m.i) + ', нужно 250 мА' }; },

    score(m) { return bandScore(m.i, 0.25, 0.06); },
    scoreNote(m) { return 'Ручка стоит на ' + fmtOhms(m.rp) + ', ток ' + fmtAmps(m.i); },

    meter(m) {
      return [
        ['Ток осветителя', fmtAmps(m.i), m.ok ? 'good' : 'warn'],
        ['Ручка', fmtOhms(m.rp)],
        ['На лампе', fmtVolts(m.uLamp)],
        ['На ручке', fmtVolts(m.uPot)],
        ['Греется ручка', fmtWatts(m.pPot)],
      ];
    },
  }));
})();
