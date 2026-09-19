'use strict';
// В-07 · Общий обратный провод. Земля — не абстрактный ноль, а кусок меди,
// у которого есть сопротивление. Как только по нему течёт чужой ток, «ноль»
// перестаёт быть нулём — и все измерения относительно него уезжают.

(() => {
  const RET_KIT = [0.1, 0.22, 0.47, 1, 2.2, 4.7];
  const L = Rig.rows({
    // Петля одна, а значок нужен: урок про сопротивление самого обратного провода: значок отмечает НАСТОЯЩУЮ землю.
    groundSymbol: true,
    id: 'v_share',
    board: DB.m.board,
    busX: { RET: 0.62 },
    supply: { id: 'SUP', name: 'Ввод узла', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.45,
    rows: [
      {
        id: 'HT', to: 'RET', rated: 0.45,
        items: [{ id: 'HEAT', kind: 'device', name: 'Силовой потребитель', silk: 'EK1', value: 30, rated: { pMax: 8.0, tau: 2.0 } }],
      },
      {
        id: 'DIV', to: 'RET', rated: 0.01,
        items: [
          { id: 'R1', kind: 'resistor', name: 'Верхнее плечо опоры', silk: 'R1', value: 1000, showValue: true, rated: { pMax: 1.0, tau: 1.0 } },
          { id: 'R2', kind: 'resistor', name: 'Нижнее плечо опоры', silk: 'R2', value: 1000, showValue: true, rated: { pMax: 1.0, tau: 1.0 } },
        ],
      },
      {
        id: 'RT', from: 'RET', rated: 0.45,
        items: [deckSocket('RG', 'Обратный провод', { silk: 'W1', title: 'Чем возвращать ток на землю', jumper: false, kit: RET_KIT, rated: { pMax: 3.0, tau: 1.5 } })],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'v_share',
    index: 46,
    title: 'Общий обратный провод',
    teaches: 'земля тоже имеет сопротивление',
    silk: 'RTN-006-32',
    diag: 'ДИАГНОСТИКА · Узел В-07: опора уходит вверх ровно тогда, когда работает силовой потребитель.',
    brief: 'Делитель опоры собран из двух одинаковых плеч и обязан давать ровно половину шины — шесть вольт относительно земли. Даёт больше. Оба плеча целы и одинаковы, шина в норме. Общим у делителя с силовым потребителем остался только обратный провод, и его гнездо пустое.',
    lesson: 'Обратный провод — такой же проводник, с собственным сопротивлением. Пока по нему течёт ток силового потребителя, на нём падает напряжение, и точка, которую все считают землёй, оказывается выше настоящей земли. Всё, что меряется относительно неё, уезжает вверх — при том что сам делитель исправен. Лечится это не подбором плеч, а обратным проводом потолще.',
    reveal: 'Точка сведения земель. Тот, кто собирал этот узел, вывел силовую и измерительную землю в одну точку — и оставил записку: «иначе показания врут».',
    hints: [
      'Наведи курсор на обратный провод: посмотри, сколько вольт падает на нём самом.',
      'Ток силового потребителя возвращается на землю по тому же проводу, что и ток делителя.',
      'Плечи делителя тут ни при чём — они одинаковые. Меняй обратный провод.',
    ],
    codex: ['ground', 'wire', 'divider', 'ohm', 'current'],
    vmax: 12.0,
    hold: 2.5,
    scale: DB.m.scale,
    board: DB.m.board,
    map: { pos: vec(108, -135), radius: 900, color: hex(0x1a7fa8), from: ['v_scale', 'v_leak'], icon: { kind: 'resistor', value: 0.22 } },
    goalText: 'Опора — 6,00 В относительно земли (допуск ±1,5%), силовой потребитель работает.',
    scope: { label: 'Опора относительно земли', get: (m) => m.mid, min: 5, max: 7.5, band: [5.91, 6.09], fmt: fmtVolts },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    read(sol, refs, P) {
      // Без обратного провода вся измерительная точка ни к чему не
      // подключена — показывать её «напряжение» значит показывать утечку.
      const built = !!P.RG.content;
      const mid = built ? (sol.nodeVoltage.DIV_1 || 0) : NaN;
      const ret = built ? (sol.nodeVoltage.RET || 0) : NaN;
      const iHeat = Math.abs(sol.componentCurrent.HEAT || 0);
      return {
        mid, ret, iHeat,
        bus: sol.nodeVoltage.VCC || 0,
        empty: !P.RG.content,
        heatOk: iHeat >= 0.38,
        ok: built && inPct(mid, 6.0, 0.015) && iHeat >= 0.38,
      };
    },

    status(m) {
      if (m.empty) return ['Обратного провода нет — цепь разомкнута совсем.', 'neutral'];
      if (m.ok) return ['Шесть вольт ровно. Обратный провод больше не поднимает землю под делителем.', 'good'];
      if (!m.heatOk) return ['Обратный провод так велик, что душит и силовой потребитель: он почти не берёт ток.', 'warn'];
      if (isBadNum(m.mid)) return ['Опора ни к чему не подключена.', 'neutral'];
      return ['Опора ' + fmtVolts(m.mid) + ' вместо шести: на обратном проводе падает ' + fmtVolts(m.ret) + ', и вся опора поднята на столько же.', 'warn'];
    },

    goal(m) {
      if (m.empty) return { ok: false, note: 'Обратный провод не поставлен.' };
      if (!m.heatOk) return { ok: false, note: 'Силовой потребитель берёт ' + fmtAmps(m.iHeat) + ', нужно не меньше 380 мА' };
      return { ok: inPct(m.mid, 6.0, 0.015), note: 'Опора ' + fmtVolts(m.mid) + ', нужно 6,00 В' };
    },

    score(m) { return m.ok ? bandScore(m.mid, 6.0, 0.015) : 0; },
    scoreNote(m) { return 'На обратном проводе осталось ' + fmtVolts(m.ret) + ' — и ровно на столько же опора была поднята'; },

    meter(m) {
      return [
        ['Опора над землёй', fmtVolts(m.mid), inPct(m.mid, 6.0, 0.015) ? 'good' : (isBadNum(m.mid) ? '' : 'warn')],
        ['Точка сведения земель', fmtVolts(m.ret), isBadNum(m.ret) ? '' : (m.ret > 0.12 ? 'bad' : 'good')],
        ['Ток силового потребителя', fmtAmps(m.iHeat), m.heatOk ? 'good' : 'warn'],
        ['На шине', fmtVolts(m.bus)],
        ['Нужно', '6,00 В · ток не ниже 380 мА'],
      ];
    },
  }));
})();
