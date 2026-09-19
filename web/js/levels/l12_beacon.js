'use strict';
// Уровень 12 · Проблесковый маячок.
// Время делают из сопротивления и ёмкости — без часов и без программы.
// Здесь же вылезает второй, менее очевидный предел: если сопротивление
// слишком велико, напряжение вообще не дорастает до порога, и маячок не
// мигает никогда — сколько ни жди.

const Level12 = createLevel(LevelRegistry.register({
  id: 'beacon',
  index: 26,
  title: 'Проблесковый маячок',
  teaches: 'постоянная времени',
  silk: 'BCN-RC-12',
  diag: 'ДИАГНОСТИКА · Проблесковый маячок мигает чаще расчётного периода.',
  brief: 'Маячок должен давать проблеск примерно раз в полторы-две секунды. Сейчас он частит так, что сливается в ровное свечение.',
  lesson: 'Конденсатор наливается через резистор, реле следит за напряжением на нём и в нужный момент разряжает его через лампу. Период задают вместе сопротивление и ёмкость: больше любого из двух — дольше пауза. Но если сопротивление слишком велико, напряжение просто не дорастёт до порога срабатывания, и проблеска не будет вообще.',
  hints: [
    'Смотри на ленту: видно, как напряжение на конденсаторе растёт, доходит до порога и падает.',
    'Нужно замедлить примерно в четыре раза. Помогает и большее сопротивление, и большая ёмкость.',
    'Слишком большое сопротивление всё ломает: кривая выходит на полку ниже порога. Найди самое большое, при котором порог ещё достигается.',
  ],
  codex: ['rc', 'capacitor', 'relay', 'lamp'],
  vmax: 12.0,
  hold: 3.5,
  scale: 1.28,
  board: { x: -310, y: -138, w: 620, h: 280 },
  map: { pos: vec(-967, -300), radius: 900, color: hex(0xffb040), from: 'pump', icon: { kind: 'lamp' } },
  goalText: 'Проблеск раз в 1,35–1,95 секунды, стабильно.',
  scope: { label: 'Напряжение на конденсаторе', get: (m) => m.uCap, min: 0, max: 8, band: [4.6, 5.0], fmt: fmtVolts },

  parts: [
    { id: 'SUP', kind: 'supply', pos: vec(-234, -74), name: 'Питание маячка', label: '12 В', silk: 'G1', nets: ['VCC', 'GND'], comp: 'V1' },
    {
      id: 'R', kind: 'socket', pos: vec(-40, -92), name: 'Зарядный резистор', silk: 'R1',
      nets: ['VCC', 'CAP'], comp: 'R1', showValue: true, valueText: socketLabel,
      content: { kind: 'resistor', value: 100 }, rated: { pMax: 2.0, tau: 1.0 },
      interact: { type: 'pick', title: 'Через что заряжать', hint: 'Нажми, чтобы сменить номинал', options: () => socketOptions({ empty: false, jumper: false, kit: [100, 220, 470, 1000, 2200] }) },
    },
    {
      id: 'C', kind: 'capacitor', pos: vec(96, -66), name: 'Накопитель', silk: 'C1',
      value: 470e-6, vMax: 6, nets: ['CAP', 'GND'], comp: 'C1', flipped: true,
      showValue: true, valueText: (p) => fmtFarads(p.value), noPads: false,
      interact: {
        type: 'pick', title: 'Ёмкость накопителя', hint: 'Нажми, чтобы сменить ёмкость',
        options: () => [470e-6, 1000e-6, 2200e-6, 4700e-6].map((f) => ({ label: fmtFarads(f), value: f })),
      },
    },
    {
      id: 'RLY', kind: 'relay', pos: vec(-40, 26), name: 'Пороговое реле', silk: 'K1',
      nets: ['CAP', 'GND'], comp: 'K1_COIL',
      terminals: { coilA: vec(-48, 42), coilB: vec(-12, 42), comA: vec(14, 42), comB: vec(48, 42) },
    },
    {
      id: 'LAMP', kind: 'lamp', pos: vec(190, 68), name: 'Лампа маячка', silk: 'HL1',
      nets: ['FL', 'GND'], comp: 'LAMP', rated: { pNom: 2.0, pMax: 120, tau: 0.12 },
    },
  ],

  wires: [
    { pts: [vec(-170, -92), vec(-84, -92)], net: 'VCC', via: 'R1', rated: 0.06 },
    { pts: [vec(4, -92), vec(82, -92), vec(82, -24)], net: 'CAP', via: 'R1', rated: 0.06 },
    { pts: [vec(82, -24), vec(82, -8), vec(-88, -8), vec(-88, 68)], net: 'CAP', via: 'K1_COIL', rated: 0.02 },
    // Второй вывод контакта (comB) реле — та же сеть CAP, что и у катушки:
    // контакт и катушка сидят на конденсаторе одной стороной, это и делает
    // реле пороговым элементом. Без этого провода comB торчал ни к чему не
    // подключённым, хотя разрядный контур (через лампу на GND) физически
    // замкнут через него же. Заход на y=-16, а не -8: на -8 дорожка легла
    // бы 74 px поверх уже существующего горизонтального участка того же
    // провода к катушке — сливаясь в одну линию. На -16 она лишь один раз
    // пересекает его ВЕРТИКАЛЬНЫЙ отрезок (-24..-8) под прямым углом,
    // честным Т-примыканием, а не ложится рядом.
    { pts: [vec(8, 68), vec(8, -16), vec(82, -16)], net: 'CAP', via: 'K1_COIL', rated: 0.02 },
    { pts: [vec(-52, 68), vec(-52, 104), vec(-170, 104), vec(-170, -56)], net: 'GND', via: 'K1_COIL', rated: 0.02 },
    { pts: [vec(110, -24), vec(140, -24), vec(140, -8), vec(140, 104)], net: 'GND', via: 'R1', rated: 0.06 },
    { pts: [vec(-26, 68), vec(-26, 90), vec(120, 90), vec(120, 68), vec(156, 68)], net: 'FL', via: 'LAMP', rated: 0.6 },
    // Земляная шина внизу — общая, но рисовать её обязан ОДИН провод.
    // Раньше этот доходил до x=-170, и участок -170..-52 полностью лежал
    // под проводом катушки, который идёт там же: 118 px двух дорожек одна
    // на другой. Обе на GND, поэтому решателю всё равно и в лог ничего не
    // попадало — видно только глазом, как «жирная» дорожка. Теперь этот
    // кончается там, где шина уходит налево (-52,104), — получается
    // честное T-примыкание, а пятак в этой точке ставит wireJunctions.
    { pts: [vec(224, 68), vec(270, 68), vec(270, 104), vec(-52, 104)], net: 'GND', via: 'LAMP', rated: 0.6 },
  ],

  topologyKey(P) { return String(P.C.value); },

  build(c, P) {
    addSupply(c, 'VCC', 'GND', 12.0, 'V1', SUPPLY_R.BENCH);
    const r1 = c.addResistor('VCC', 'CAP', 100, 'R1');
    const cap = c.addCapacitor('CAP', 'GND', P.C.value, 'C1');
    // Реле здесь работает пороговым элементом: катушка висит на
    // конденсаторе и следит за его напряжением, а контакт разряжает его
    // через лампу. Гистерезис реле и превращает это в мигалку.
    const relay = makeRelay(c, 'CAP', 'GND', 'CAP', 'FL', 'K1', { coilOhms: 400, pullIn: 0.012, dropOut: 0.006 });
    const lamp = addLamp(c, 'FL', 'GND', 10.0, 'LAMP');
    return { R1: r1, CAP: cap, RELAY: relay, LAMP: lamp };
  },

  apply(refs, P, c) { c.setResistance(refs.R1, socketOhms(P.R)); },

  tick(dt, P, m, refs, c) {
    const was = refs.RELAY.closed;
    const closed = refs.RELAY.update(c, m.iCoil, dt);
    P.RLY.closedNow = closed;
    P.RLY.pull = refs.RELAY.pull;
    P.RLY.sinceFlash = (P.RLY.sinceFlash || 0) + dt;
    if (closed && !was) {
      // Замер периода — по фронтам срабатывания, как это и меряют.
      if (P.RLY.sinceFlash > 0.02 && P.RLY.sinceFlash < 30) P.RLY.period = P.RLY.sinceFlash;
      P.RLY.sinceFlash = 0;
      P.RLY.flashes = (P.RLY.flashes || 0) + 1;
    }
    // Если проблесков давно нет — период считается неизвестным, иначе
    // старое значение врало бы, что всё ещё мигает.
    if (P.RLY.sinceFlash > 6) P.RLY.period = 0;
  },

  read(sol, refs, P) {
    return {
      uCap: sol.nodeVoltage['CAP'] || 0,
      iCoil: Math.abs(sol.componentCurrent['K1_COIL'] || 0),
      iLamp: Math.abs(sol.componentCurrent['LAMP'] || 0),
      period: P.RLY.period || 0,
      flashes: P.RLY.flashes || 0,
      idle: P.RLY.sinceFlash || 0,
    };
  },

  partView(part, m, P) {
    if (part.id === 'RLY') return { pull: P.RLY.pull || 0 };
    return null;
  },

  status(m) {
    if (m.idle > 4 && !m.period) return ['Проблесков нет: напряжение вышло на полку и до порога так и не дошло. Сопротивление слишком большое.', 'bad'];
    if (!m.period) return ['Ждём первый проблеск…', 'neutral'];
    if (m.period < 1.35) return ['Частит: период ' + fmtSeconds(m.period) + '. Надо медленнее.', 'warn'];
    if (m.period > 1.95) return ['Слишком редко: период ' + fmtSeconds(m.period) + '.', 'warn'];
    return ['Ровно тот ритм, что нужен: ' + fmtSeconds(m.period) + ' между проблесками.', 'good'];
  },

  goal(m) {
    return {
      ok: m.period >= 1.35 && m.period <= 1.95,
      note: m.period ? 'Период ' + fmtSeconds(m.period) : 'Периода пока нет.',
    };
  },

  score(m) { return m.period ? clamp(1 - Math.abs(m.period - 1.65) / 0.5, 0, 1) : 0; },
  scoreNote(m) { return 'Период ' + fmtSeconds(m.period) + ' · проблесков за сеанс: ' + m.flashes; },

  meter(m, P) {
    return [
      ['Период', m.period ? fmtSeconds(m.period) : '—', m.period >= 1.35 && m.period <= 1.95 ? 'good' : 'warn'],
      ['На конденсаторе', fmtVolts(m.uCap)],
      ['Порог реле', '≈ 4,8 В'],
      ['Ток лампы', fmtAmps(m.iLamp)],
      ['Ёмкость', fmtFarads(P.C.value)],
    ];
  },
}));
