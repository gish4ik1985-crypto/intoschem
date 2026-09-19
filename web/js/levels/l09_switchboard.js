'use strict';
// Уровень 9 · Распределительный щиток.
// Источник — свойство прибора, а не награда. В приборе их два, и каждому
// потребителю нужен свой: перепутали — один сгорит, другой не поедет.

const Level09 = createLevel(LevelRegistry.register({
  id: 'switchboard',
  index: 23,
  title: 'Распределительный щиток',
  teaches: 'выбор источника',
  silk: 'PWR-SEL-09',
  diag: 'ДИАГНОСТИКА · Шины 3 В и 9 В подключены к потребителям наперекрёст.',
  brief: 'В щитке две шины — 3 В и 9 В — и два потребителя. После ремонта их подключили наперекрёст: светодиод горит на пределе, а привод еле шевелится.',
  lesson: 'Напряжение выбирают не «побольше», а под потребителя. Светодиоду хватает трёх вольт, и девять его убивают; мотору три вольта дают вчетверо меньше нужного тока. Один и тот же источник для двух разных приборов — почти всегда компромисс в пользу неработающего.',
  hints: [
    'Наведи курсор на светодиод и на мотор: посмотри, сколько тока получает каждый.',
    'Светодиод рассчитан примерно на 20 мА, мотору нужно почти двести.',
    'Переключатели у каждой ветки свои — нажми на них.',
  ],
  codex: ['battery', 'led', 'motor', 'ohm'],
  vmax: 9.0,
  hold: 2.5,
  scale: 1.24,
  board: { x: -310, y: -140, w: 620, h: 290 },
  map: { pos: vec(-322, -300), radius: 900, color: hex(0xf0e08a), from: ['motor', 'heater'], icon: { kind: 'selector', choice: 'high', labels: ['3 В', '9 В'] } },
  goalText: 'Светодиод 12–26 мА, привод не меньше 150 мА.',
  scope: { label: 'Ток светодиода', get: (m) => m.iLed, min: 0, max: 0.045, band: [0.012, 0.026], fmt: fmtAmps },

  parts: [
    { id: 'SUPL', kind: 'supply', pos: vec(-236, -88), name: 'Шина 3 В', label: '3 В', silk: 'G1', nets: ['VLOW', 'GND'], comp: 'VLOW' },
    { id: 'SUPH', kind: 'supply', pos: vec(-236, 50), name: 'Шина 9 В', label: '9 В', silk: 'G2', nets: ['VHIGH', 'GND'], comp: 'VHIGH' },
    {
      id: 'SELL', kind: 'selector', pos: vec(10, -46), name: 'Переключатель · светодиод',
      silk: 'SA1', choice: 'high', labels: ['3 В', '9 В'],
      interact: { type: 'cycle', field: 'choice', values: ['low', 'high'], hint: 'Нажми, чтобы сменить шину' },
    },
    {
      id: 'SELM', kind: 'selector', pos: vec(10, 54), name: 'Переключатель · привод',
      silk: 'SA2', choice: 'low', labels: ['3 В', '9 В'],
      interact: { type: 'cycle', field: 'choice', values: ['low', 'high'], hint: 'Нажми, чтобы сменить шину' },
    },
    { id: 'RLED', kind: 'resistor', pos: vec(130, -20), name: 'Токоограничитель', silk: 'R1', value: 68, nets: ['LED_R', 'LED_A'], comp: 'RLED', showValue: true, rated: { pMax: 1.0, tau: 1.0 } },
    {
      id: 'LED', kind: 'led', pos: vec(240, -20), name: 'Индикатор', silk: 'VD1', color: hex(0x46d07a),
      // tau подобран так, чтобы сгорание при найденной перегрузке (9 В
      // вместо 3 В, около 3-кратной по мощности) занимало ~8 с — этого
      // хватает прочитать бриф и увидеть нагрев, но недостаточно, чтобы
      // не спешить с починкой.
      // tau=50, а не 20: при найденной перегрузке (9 В вместо 3) старое
      // значение жгло светодиод за 8,3 с — бриф здесь 27 слов, это около
      // 10,8 с спокойного чтения (см. CLAUDE.md, «Поломка, которая
      // происходит сама, обязана быть видимой»). Игрок не успевал
      // дочитать задачу, как всё уже сгорало. 50 даёт ~20,7 с — почти
      // вдвое больше времени на чтение, с запасом.
      nets: ['LED_A', 'GND'], comp: 'LED', rated: { pNom: 0.036, pMax: 0.075, iNom: 0.02, tau: 50.0 },
    },
    {
      id: 'MOT', kind: 'motor', pos: vec(170, 58), name: 'Привод', silk: 'M1',
      nets: ['MOT_A', 'GND'], comp: 'MOTOR', rated: { iNom: 0.19, pMax: 3.5, tau: 0.9 },
    },
  ],

  // Переключатель физически соединяет ветку с ОДНОЙ шиной — рисуем только
  // тот провод, который сейчас существует.
  wires(P) {
    const lowBusX = -140, highBusX = -100, ledY = -20, motY = 80;
    const list = [
      { pts: [vec(58, -20), vec(92, -20)], net: 'LED_R', via: 'LED', rated: 0.03 },
      { from: 'RLED.b', to: 'LED.a', net: 'LED_A', via: 'LED', rated: 0.03 },
      { pts: [vec(58, 80), vec(127, 80)], net: 'MOT_A', via: 'MOTOR', rated: 0.2 },
      { pts: [vec(270, -20), vec(278, -20), vec(278, 104)], net: 'GND', via: 'LED', rated: 0.03 },
      { pts: [vec(213, 80), vec(278, 80)], net: 'GND', via: 'MOTOR', rated: 0.2 },
      // Земляной рельс — по x=-158, а не по x=-172. На -172 он проходил
      // ровно через ПЛЮСОВОЙ вывод шины 9 В (-172,32): начало провода
      // VHIGH лежало на пути провода GND, и wireJunctions ставил там пятак,
      // то есть картинка сажала плюс девяти вольт на землю. К минусам
      // обоих блоков питания рельс подходит явными отводами.
      { pts: [vec(278, 104), vec(-158, 104), vec(-158, -70), vec(-172, -70)], net: 'GND', via: 'MOTOR', rated: 0.2 },
      { pts: [vec(-158, 68), vec(-172, 68)], net: 'GND', via: 'LED', rated: 0.03 },
    ];
    // Каждая шина существует ровно настолько, насколько к ней что-то
    // подключено. Раньше обе были нарисованы на всю высоту всегда, и конец
    // неиспользуемой шины ложился ТОЧНО НА ветку чужой шины: например при
    // светодиоде на 3 В конец шины 9 В попадал на (-100,-20) — а это точка
    // на проводе, идущем от шины 3 В к светодиоду. wireJunctions видит
    // конец провода на чужом пути и честно ставит там паяный пятак — и
    // картинка утверждала, что светодиод сидит сразу на обеих шинах.
    // Решателю всё равно (провода здесь декоративные), а игрок видит на
    // одной дорожке два узла и не понимает, какой из них настоящий.
    const lowTaps = [], highTaps = [];
    (P.SELL.choice === 'low' ? lowTaps : highTaps).push(ledY);
    (P.SELM.choice === 'low' ? lowTaps : highTaps).push(motY);

    // 3 В: питание входит сверху, на y=-106, шина идёт вниз до нижнего
    // из своих потребителей.
    if (lowTaps.length) {
      list.push({ pts: [vec(-172, -106), vec(lowBusX, -106), vec(lowBusX, Math.max.apply(null, lowTaps))], net: 'VLOW', via: 'VLOW', dir: -1, rated: 0.2 });
    }
    // 9 В: питание входит сбоку, на y=32, поэтому шина растёт от точки
    // входа в обе стороны — до крайних своих потребителей.
    if (highTaps.length) {
      const ys = [32].concat(highTaps);
      list.push({ pts: [vec(-172, 32), vec(highBusX, 32)], net: 'VHIGH', via: 'VHIGH', dir: -1, rated: 0.2 });
      list.push({ pts: [vec(highBusX, Math.min.apply(null, ys)), vec(highBusX, Math.max.apply(null, ys))], net: 'VHIGH', via: 'VHIGH', rated: 0.2 });
    }

    const ledX = P.SELL.choice === 'low' ? lowBusX : highBusX;
    list.push({ pts: [vec(ledX, ledY), vec(-38, ledY)], net: P.SELL.choice === 'low' ? 'VLOW' : 'VHIGH', via: 'LED', rated: 0.03 });
    const motX = P.SELM.choice === 'low' ? lowBusX : highBusX;
    list.push({ pts: [vec(motX, motY), vec(-38, motY)], net: P.SELM.choice === 'low' ? 'VLOW' : 'VHIGH', via: 'MOTOR', rated: 0.2 });
    return list;
  },

  build(c) {
    addSupply(c, 'VLOW', 'GND', 3.0, 'VLOW', SUPPLY_R.BENCH);
    addSupply(c, 'VHIGH', 'GND', 9.0, 'VHIGH', SUPPLY_R.BENCH);
    const swLedLow = c.addSwitch('VLOW', 'LED_R', false, 'SL_L');
    const swLedHigh = c.addSwitch('VHIGH', 'LED_R', false, 'SL_H');
    const rled = c.addResistor('LED_R', 'LED_A', 68, 'RLED');
    const led = addLed(c, 'LED_A', 'GND', 'LED', 1.8);
    const swMotLow = c.addSwitch('VLOW', 'MOT_A', false, 'SM_L');
    const swMotHigh = c.addSwitch('VHIGH', 'MOT_A', false, 'SM_H');
    const motor = addMotor(c, 'MOT_A', 'GND', 47.0, 'MOTOR');
    return { SL_L: swLedLow, SL_H: swLedHigh, SM_L: swMotLow, SM_H: swMotHigh, RLED: rled, LED: led, MOTOR: motor };
  },

  apply(refs, P, c) {
    c.setSwitch(refs.SL_L, P.SELL.choice === 'low');
    c.setSwitch(refs.SL_H, P.SELL.choice === 'high');
    c.setSwitch(refs.SM_L, P.SELM.choice === 'low');
    c.setSwitch(refs.SM_H, P.SELM.choice === 'high');
  },

  read(sol, refs, P) {
    return {
      iLed: Math.abs(sol.componentCurrent['LED'] || 0),
      iMot: Math.abs(sol.componentCurrent['MOTOR'] || 0),
      ledBurnt: P.LED.burnt,
    };
  },

  status(m) {
    if (m.ledBurnt) return ['Индикатор сгорел: девять вольт для него — верная смерть. Переключи его шину и поставь новый — кнопка внизу слева.', 'bad'];
    const ledOk = m.iLed >= 0.012 && m.iLed <= 0.026;
    const motOk = m.iMot >= 0.15;
    if (ledOk && motOk) return ['Каждый получил своё: индикатор горит ровно, привод идёт в полную силу.', 'good'];
    if (!ledOk && m.iLed > 0.026) return ['Индикатор на пределе — на нём слишком высокое напряжение.', 'bad'];
    if (!motOk && m.iMot > 0.001) return ['Привод еле шевелится: трёх вольт ему мало.', 'warn'];
    return ['Разберись, какому прибору какая шина нужна.', 'neutral'];
  },

  goal(m) {
    const ledOk = !m.ledBurnt && m.iLed >= 0.012 && m.iLed <= 0.026;
    const motOk = m.iMot >= 0.15;
    return {
      ok: ledOk && motOk,
      note: 'Индикатор ' + fmtAmps(m.iLed) + ' · привод ' + fmtAmps(m.iMot),
    };
  },

  score(m) {
    if (m.ledBurnt) return 0;
    const a = clamp(m.iLed / 0.02, 0, 1);
    const b = clamp(m.iMot / 0.19, 0, 1);
    return (a + b) / 2;
  },
  scoreNote(m) { return 'Индикатор ' + fmtAmps(m.iLed) + ' · привод ' + fmtAmps(m.iMot); },

  meter(m, P) {
    const bus = (c) => (c === 'low' ? '3 В' : '9 В');
    return [
      ['Ток индикатора', fmtAmps(m.iLed), m.ledBurnt ? 'bad' : (m.iLed >= 0.012 && m.iLed <= 0.026 ? 'good' : 'warn')],
      ['Нагрев индикатора', Math.round(clamp(P.LED.heat, 0, 1) * 100) + '%',
        P.LED.burnt ? 'bad' : (P.LED.heat > 0.5 ? 'warn' : '')],
      ['Ток привода', fmtAmps(m.iMot), m.iMot >= 0.15 ? 'good' : 'warn'],
      ['Индикатор на шине', bus(P.SELL.choice)],
      ['Привод на шине', bus(P.SELM.choice)],
      ['Итого от щитка', fmtAmps(m.iLed + m.iMot)],
    ];
  },
}));
