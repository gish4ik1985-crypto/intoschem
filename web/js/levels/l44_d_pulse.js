'use strict';
// Д-04 · Импульс разряда. Накопитель отдаёт всё, что набрал, за доли секунды,
// и ток в этот момент ограничивает только разрядная цепь. Попасть надо не
// «побольше», а в коридор — и это уже совсем другая задача.

(() => {
  const DIS_KIT = [4.7, 10, 22, 33, 47];
  const L = Rig.rows({
    id: 'd_pulse',
    board: DB.xl.board,
    busX: { CAP: 0.28 },
    supply: { id: 'SUP', name: 'Ввод накопителя', label: '12 В', silk: 'G1', value: 12 },
    rated: 0.06,
    rows: [
      {
        id: 'CH', to: 'CAP', rated: 0.06,
        items: [{ id: 'RCH', kind: 'resistor', name: 'Зарядный', silk: 'R1', value: 220, showValue: true, rated: { pMax: 1.0, tau: 1.0 } }],
      },
      {
        id: 'CP', from: 'CAP', rated: 0.8,
        items: [{ id: 'C1', kind: 'capacitor', name: 'Накопитель ядра', silk: 'C1', value: 10000e-6, vMax: 16, label: '10000 мкФ' }],
      },
      {
        id: 'DS', from: 'CAP', rated: 0.8,
        items: [
          {
            id: 'SB1', kind: 'button', name: 'Спуск', silk: 'SB1', closed: false,
            interact: { type: 'press', hint: 'Держи нажатой — накопитель разрядится в нагрузку' },
          },
          deckSocket('RD', 'Разрядный', { silk: 'R2', title: 'Через что разряжать', jumper: false, kit: DIS_KIT, rated: { pMax: 20.0, tau: 0.4 } }),
          { id: 'HL1', kind: 'lamp', name: 'Импульсная нагрузка', silk: 'HL1', value: 4, rated: { pNom: 2.5, pMax: 40.0, tau: 0.2 } },
        ],
      },
    ],
  });

  createLevel(LevelRegistry.register({
    id: 'd_pulse',
    index: 58,
    title: 'Импульс разряда',
    teaches: 'накопитель отдаёт всё разом',
    silk: 'PLS-790-44',
    diag: 'ДИАГНОСТИКА · Узел Д-04: импульс вне коридора, разрядное гнездо пустое.',
    brief: 'Накопитель набирается сам, через зарядный резистор — это видно на ленте. Импульс по спуску должен дать ровно 790 мА: слабее не сработает, сильнее сожжёт нагрузку. Разрядное гнездо пустое.',
    lesson: 'Заряженный накопитель в момент разряда работает источником: напряжение на нём уже есть, и ток ограничивает только то, что стоит на пути. Поэтому величина импульса задаётся не ёмкостью и не зарядным резистором, а разрядной цепью — ёмкость определяет лишь, надолго ли этого тока хватит.',
    reveal: 'Импульсный передатчик. Он бил короткими вспышками в эфир — по одной за раз, копя между ними. Последняя запись счётчика: сорок одна тысяча импульсов.',
    hints: [
      'Смотри на ленту: сначала дай накопителю набраться, потом жми спуск.',
      'В момент нажатия на накопителе почти двенадцать вольт. Ток импульса — это они, делённые на разрядную цепь.',
      'Сама нагрузка даёт 4 ома. Двенадцать вольт делить на 0,79 ампера — около пятнадцати ом на всю разрядную цепь.',
    ],
    codex: ['capacitor', 'rc', 'ohm', 'power', 'lamp'],
    vmax: 12.0,
    hold: 0,
    // Победа здесь — последовательность во времени (накопить, потом дать
    // импульс), а не положение деталей: перебор состояний её не найдёт.
    sequenced: true,
    minScore: 0.6,
    scale: DB.xl.scale,
    board: DB.xl.board,
    map: { pos: vec(538, 100), radius: 900, color: hex(0xffd166), from: ['d_clamp', 'v_match'], icon: { kind: 'capacitor', value: 10000e-6 } },
    goalText: 'Импульс — 790 мА (допуск ±10%).',
    scope: { label: 'Напряжение накопителя', get: (m) => m.uCap, min: 0, max: 12, band: [10.5, 12], fmt: fmtVolts },

    parts: L.parts,
    wires: L.wires,
    build: (c, P) => Rig.build(c, P),
    apply: (refs, P, c) => Rig.apply(c, refs, P),

    // Пик живёт доли кадра, поэтому его пишет каркас внутри шагов решателя.
    // Отпущенный спуск обнуляет счёт: каждое нажатие — отдельный импульс, и
    // неудачная попытка не должна навсегда остаться в памяти узла.
    tick(dt, P) {
      if (!P.SB1.closed) P.HL1.iMax = 0;
    },

    read(sol, refs, P) {
      const peak = P.HL1.iMax || 0;
      return {
        uCap: sol.nodeVoltage.CAP || 0,
        i: Math.abs(sol.componentCurrent.HL1 || 0),
        peak,
        held: !!P.SB1.closed,
        empty: !P.RD.content,
        ready: (sol.nodeVoltage.CAP || 0) > 10.5,
        ok: inPct(peak, 0.79, 0.10),
      };
    },

    status(m) {
      if (m.empty) return ['Разрядное гнездо пустое — импульса не будет.', 'neutral'];
      if (m.ok) return ['Импульс ' + fmtAmps(m.peak) + '. Ровно то, что просит паспорт.', 'good'];
      if (m.held && m.peak > 0.869) return ['Импульс ' + fmtAmps(m.peak) + ' — слишком сильный, разрядное сопротивление мало.', 'warn'];
      if (m.held && m.peak > 0) return ['Импульс ' + fmtAmps(m.peak) + ' — слабоват, разрядное сопротивление велико.', 'warn'];
      if (!m.ready) return ['Накопитель набирается: ' + fmtVolts(m.uCap) + ' из двенадцати. Рано.', 'warn'];
      return ['Накопитель полон. Жми спуск.', 'good'];
    },

    goal(m) {
      if (m.empty) return { ok: false, note: 'Разрядное гнездо пустое.' };
      if (!m.peak) return { ok: false, note: m.ready ? 'Накопитель полон — жми спуск.' : 'Накопитель набирается: ' + fmtVolts(m.uCap) };
      return { ok: m.ok, note: 'Импульс ' + fmtAmps(m.peak) + ', нужно 790 мА' };
    },

    score(m) { return bandScore(m.peak, 0.79, 0.10); },
    scoreNote(m) { return 'Импульс ' + fmtAmps(m.peak) + ' — сам источник столько и близко не даёт'; },

    meter(m) {
      return [
        ['Импульс', m.peak > 0 ? fmtAmps(m.peak) : '—', m.ok ? 'good' : (m.peak > 0 ? 'warn' : '')],
        ['На накопителе', fmtVolts(m.uCap), m.ready ? 'good' : 'warn'],
        ['Ток сейчас', fmtAmps(m.i)],
        ['Спуск', m.held ? 'нажат' : 'отпущен'],
        ['Нужно', '790 мА'],
      ];
    },
  }));
})();
