'use strict';
// Уровень 1 · Сигнальный светодиод.
// Учит двум вещам сразу: цепь должна быть замкнута, и ток надо ограничить.
// Изъян прибора: гнездо перед светодиодом пустое.

const Level01 = createLevel(LevelRegistry.register({
  id: 'led',
  index: 15,
  title: 'Сигнальный светодиод',
  teaches: 'резистор · диод',
  silk: 'SIG-LED-01',
  diag: 'ДИАГНОСТИКА · Контур ночного зрения обесточен.',
  brief: 'Светодиод не горит, гнездо перед ним пустое. Подбери, что туда поставить, — и не сожги его.',
  lesson: 'Светодиод сам себя не бережёт: сколько тока дадут, столько и возьмёт — и сгорит. Резистор перед ним притормаживает ток.',
  hints: [
    'Пустое гнездо — это разрыв. Пока в нём ничего нет, цепи нет вообще.',
    'Перемычка замкнёт цепь, но ничего не ограничит. Посмотри на приборы, что при этом будет с током.',
    'Пробуй резисторы по очереди: чем больше ом, тем тусклее. Нужен самый яркий, при котором светодиод не греется.',
  ],
  codex: ['current', 'resistor', 'led', 'battery', 'ohm'],
  vmax: 3.0,
  hold: 2.0,
  // Первый узел ЧУЖОЙ платы: свет на него приводит стенд, а не он сам себя.
  map: {
    pos: vec(-322, -700), radius: 900, color: hex(0xff5a33), from: ['t_led', 't_diode'],
    icon: { kind: 'led', color: hex(0xff4a2c) },
  },
  goalText: 'Светодиод горит ярко и не сгорает.',
  scope: { label: 'Ток через светодиод', get: (m) => m.i, min: 0, max: 0.045, band: [0.015, 0.026], fmt: fmtAmps },

  parts: [
    {
      id: 'BAT2', kind: 'cell', pos: vec(-232, -48), name: 'Батарейка (нижняя по цепи)', label: '1,5 В',
      silk: 'BT2', nets: ['MID', 'GND'], comp: 'V2',
    },
    {
      id: 'BAT1', kind: 'cell', pos: vec(-96, -48), name: 'Батарейка', label: '1,5 В',
      silk: 'BT1', nets: ['VCC', 'MID'], comp: 'V1',
    },
    {
      id: 'SLOT', kind: 'socket', pos: vec(70, -48), name: 'Гнездо ограничителя',
      silk: 'R1', nets: ['VCC', 'LED_A'], comp: 'R1', showValue: true,
      valueText: socketLabel,
      content: null,
      rated: { pMax: 0.5, tau: 1.2 },
      interact: {
        type: 'pick', title: 'Что поставить в гнездо', hint: 'Нажми, чтобы выбрать деталь',
        options: () => socketOptions(),
      },
    },
    {
      id: 'LED', kind: 'led', pos: vec(208, -48), name: 'Сигнальный светодиод',
      silk: 'VD1', nets: ['LED_A', 'GND'], comp: 'LED', color: hex(0xff4a2c),
      rated: { pNom: 0.036, pMax: 0.075, iNom: 0.02, tau: 0.45 },
    },
  ],

  wires: [
    { from: 'BAT2.b', to: 'BAT1.a', net: 'MID', via: 'LED', rated: 0.026 },
    { from: 'BAT1.b', to: 'SLOT.a', net: 'VCC', via: 'LED', rated: 0.026 },
    { from: 'SLOT.b', to: 'LED.a', net: 'LED_A', via: 'LED', rated: 0.026 },
    {
      pts: [vec(238, -48), vec(270, -48), vec(270, 58), vec(-284, 58), vec(-284, -48)],
      net: 'GND', via: 'LED', rated: 0.026,
    },
  ],

  build(c) {
    addSupply(c, 'VCC', 'MID', 1.5, 'V1', SUPPLY_R.AA_CELL);
    addSupply(c, 'MID', 'GND', 1.5, 'V2', SUPPLY_R.AA_CELL);
    const r1 = c.addResistor('VCC', 'LED_A', 1e9, 'R1');
    const led = addLed(c, 'LED_A', 'GND', 'LED', 1.8);
    return { R1: r1, LED: led };
  },

  apply(refs, P, c) {
    c.setResistance(refs.R1, socketOhms(P.SLOT));
  },

  read(sol, refs, P) {
    const i = sol.componentCurrent['LED'] || 0;
    return {
      i,
      uLed: (sol.nodeVoltage['LED_A'] || 0),
      uRes: (sol.nodeVoltage['VCC'] || 0) - (sol.nodeVoltage['LED_A'] || 0),
      pRes: P.SLOT.p,
      burnt: P.LED.burnt,
      empty: !P.SLOT.content,
    };
  },

  status(m, P) {
    if (m.burnt) return ['Светодиод сгорел. Ток был слишком большой — ограничивать было нечем.', 'bad'];
    if (m.empty) return ['Цепь разомкнута: в гнезде пусто, току некуда идти.', 'neutral'];
    if (P.SLOT.content.kind === 'jumper') return ['Перемычка ничего не ограничивает — весь ток идёт напрямую в светодиод.', 'bad'];
    if (m.i > 0.026) return ['Ярко, но ток выше нормы — светодиод греется и долго не проживёт.', 'warn'];
    if (m.i < 0.0015) return ['Почти не светит: сопротивление слишком большое, ток гасится в резисторе.', 'warn'];
    if (m.i < 0.015) return ['Горит тускло. Возьми резистор поменьше.', 'warn'];
    return ['Горит ровно. Этот резистор подходит.', 'good'];
  },

  goal(m) {
    if (m.burnt) return { ok: false, note: 'Светодиод сгорел — замени его и начни заново.' };
    if (m.empty) return { ok: false, note: 'Гнездо пустое.' };
    return {
      ok: m.i >= 0.015 && m.i <= 0.026,
      note: 'Ток сейчас ' + fmtAmps(m.i) + ', нужно 15–26 мА.',
    };
  },

  score(m) {
    if (m.burnt) return 0;
    return clamp(m.i / 0.02, 0, 1);
  },

  scoreNote(m) {
    return 'Ток ' + fmtAmps(m.i) + ' · на светодиоде ' + fmtVolts(m.uLed) + ' · на резисторе ' + fmtVolts(m.uRes);
  },

  meter(m, P) {
    // Пустое гнездо — это разрыв, а не резистор с огромным сопротивлением:
    // показывать на нём вольты и ватты значило бы намекать, что деталь
    // там есть, хотя статус тут же говорит обратное.
    return [
      ['Ток в цепи', fmtAmps(m.i), m.burnt ? 'bad' : (m.i > 0.026 ? 'warn' : (m.i >= 0.015 ? 'good' : ''))],
      ['На светодиоде', fmtVolts(m.uLed)],
      ['На резисторе', m.empty ? '—' : fmtVolts(m.uRes)],
      ['Греется резистор', m.empty ? '—' : fmtWatts(m.pRes)],
      ['Нагрев светодиода', Math.round(clamp(P.LED.heat, 0, 1) * 100) + '%', P.LED.heat > 0.7 ? 'bad' : ''],
    ];
  },
}));
