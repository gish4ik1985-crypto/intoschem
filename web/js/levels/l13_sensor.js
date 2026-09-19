'use strict';
// Уровень 13 · Датчик протечки.
// Транзистор: крошечный ток управляет большим. Датчик даёт десятые доли
// миллиампера — этого не хватит ни на что, но хватает, чтобы открыть
// кран для тока в сто раз больше.

const Level13 = createLevel(LevelRegistry.register({
  id: 'sensor',
  index: 27,
  title: 'Датчик протечки',
  teaches: 'транзистор · усиление',
  silk: 'SNS-LEK-13',
  diag: 'ДИАГНОСТИКА · Датчик протечки не зажигает индикатор при срабатывании.',
  brief: 'Датчик срабатывает, а индикатор не загорается. Через сам датчик ток идёт мизерный — по-другому и быть не может, вода не проводник.',
  lesson: 'Транзистор — это кран, ручку которого крутит ток базы. Восемьдесят микроампер от датчика открывают почти десять миллиампер через индикатор: примерно в сто раз больше. Сам датчик при этом ничего не нагружает — а если подключить индикатор к нему напрямую, весь ток упрётся в сопротивление датчика и света не будет.',
  hints: [
    'Посмотри на ток через индикатор при прямом подключении: он на три порядка меньше нужного.',
    'Транзистор пропускает через себя ток примерно в сто раз больший, чем получает в базу.',
    'В базе уже есть ограничитель — сам датчик на сто килоом. Лишнее сопротивление там только уменьшит усиление.',
  ],
  codex: ['transistor', 'led', 'ohm', 'divider'],
  vmax: 9.0,
  hold: 2.5,
  scale: 1.28,
  board: { x: -310, y: -136, w: 620, h: 276 },
  map: { pos: vec(-1182, -300), radius: 900, color: hex(0x62d0ff), from: 'beacon', icon: { kind: 'transistor' } },
  goalText: 'Индикатор от 6 мА, при этом через датчик — не больше 0,15 мА.',
  scope: { label: 'Ток индикатора', get: (m) => m.iLed, min: 0, max: 0.014, band: [0.006, 0.014], fmt: fmtAmps },

  parts: [
    { id: 'SUP', kind: 'supply', pos: vec(-234, -70), name: 'Питание', label: '9 В', silk: 'G1', nets: ['VCC', 'GND'], comp: 'V1' },
    { id: 'SENS', kind: 'device', pos: vec(-60, -88), name: 'Датчик (вода между контактами)', label: '100 кОм', silk: 'BR1', nets: ['VCC', 'SENS'], comp: 'SENSOR' },
    {
      id: 'SEL', kind: 'selector', pos: vec(96, -86), noPads: true, name: 'Как подключён индикатор',
      silk: 'SA1', choice: 'direct', labels: ['напрямую', 'через транзистор'],
      interact: { type: 'cycle', field: 'choice', values: ['direct', 'amp'], hint: 'Нажми, чтобы переключить схему' },
    },
    { id: 'RL', kind: 'resistor', pos: vec(60, 10), name: 'Токоограничитель', silk: 'R1', value: 470, showValue: true, nets: ['RLIN', 'LED_A'], comp: 'RL', rated: { pMax: 1.0, tau: 1.0 } },
    {
      id: 'LED', kind: 'led', pos: vec(190, 10), name: 'Индикатор протечки', silk: 'VD1', color: hex(0xff4a4a),
      nets: ['LED_A', 'LEDK'], comp: 'LED', rated: { pNom: 0.02, pMax: 0.06, iNom: 0.01, tau: 0.5 },
    },
    {
      id: 'RB', kind: 'socket', pos: vec(-60, 46), name: 'Гнездо в базе', silk: 'R2',
      nets: ['SENS', 'BASE'], comp: 'RB', showValue: true, valueText: socketLabel,
      content: { kind: 'resistor', value: 100000 }, rated: { pMax: 0.5, tau: 1.0 },
      interact: {
        type: 'pick', title: 'Что стоит в базе', hint: 'Нажми, чтобы заменить',
        options: () => [
          { label: 'перемычка', note: 'без ограничения', content: { kind: 'jumper' } },
          { label: '10 кОм', content: { kind: 'resistor', value: 10000 } },
          { label: '47 кОм', content: { kind: 'resistor', value: 47000 } },
          { label: '100 кОм', content: { kind: 'resistor', value: 100000 } },
        ],
      },
    },
    // x=150, а не 190: при 190 корпус транзистора (72×76) заходил на
    // шелкографию «SNS-LEK-13» в правом нижнем углу платы.
    { id: 'T1', kind: 'transistor', pos: vec(150, 84), name: 'Транзистор n-p-n', silk: 'VT1', nets: ['BASE', 'GND'], comp: 'T1' },
  ],

  wires(P) {
    const amp = P.SEL.choice === 'amp';
    // Земляной рельс раньше шёл на y=106 — это ВНУТРИ корпуса транзистора
    // (46..122 по вертикали): дорожка рисовалась поверх картинки VT1, а не
    // рядом с ней. GY — единая высота ниже корпуса и ниже шелкографии платы
    // (та занимает y≈108..126 в правом нижнем углу), UNDER_Y — отдельная
    // высота чуть выше нее для обхода базы/коллектора: разнесены на 5 px,
    // чтобы не слиться в одну шину (см. «Разводку проверять по пяти
    // признакам» в CLAUDE.md, п. 4 «наложение»).
    const GY = 134;
    const UNDER_Y = 129;
    // Правый конец земляного рельса — от того, что к нему реально подходит
    // в этом режиме, а не всегда до x=270: в режиме «через транзистор»
    // ничего не подключено на 270, и рельс просто торчал в пустоту.
    const railEnd = amp ? 174 : 290;
    const list = [
      { pts: [vec(-170, -88), vec(-106, -88)], net: 'VCC', via: 'SENSOR', rated: 0.0002 },
      { pts: [vec(-170, GY), vec(railEnd, GY)], net: 'GND', via: 'V1', rated: 0.02 },
      { pts: [vec(-170, -46), vec(-170, GY)], net: 'GND', via: 'V1', rated: 0.02 },
      { from: 'RL.b', to: 'LED.a', net: 'LED_A', via: 'LED', rated: 0.012 },
    ];
    if (amp) {
      // Питание индикатора — прямо с шины, а датчик держит только базу.
      // Спуск плюса — на x=-150, а не x=-170: по x=-170 снизу поднимается
      // земляная шина, и часть из них шла бы ровно под этой дорожкой.
      list.push({ pts: [vec(-150, -88), vec(-150, 10), vec(22, 10)], net: 'VCC', via: 'LED', rated: 0.012 });
      // От датчика до гнезда базы — с ныряем ниже селектора (тот занимает
      // x 52..140 на этой высоте), а не сквозь его корпус.
      list.push({ pts: [vec(-14, -88), vec(-14, -30), vec(0, -30), vec(0, 46), vec(-16, 46)], net: 'SENS', via: 'RB', rated: 0.0002 });
      // База, коллектор и эмиттер транзистора — все три вывода снизу, на
      // y=118. База и коллектор обходят корпус понизу, по UNDER_Y (корпус
      // кончается на 122, плата — на 140, шелкография в углу занимает
      // y 108..126 при x 200..280, поэтому вертикаль справа идёт по x=290).
      list.push({ pts: [vec(-104, 46), vec(-130, 46), vec(-130, UNDER_Y), vec(126, UNDER_Y), vec(126, 118)], net: 'BASE', via: 'RB', rated: 0.0002 });
      list.push({ pts: [vec(220, 10), vec(290, 10), vec(290, UNDER_Y), vec(150, UNDER_Y), vec(150, 118)], net: 'LEDK', via: 'LED', rated: 0.012 });
      // Эмиттер — прямой спуск на земляной рельс, который теперь идёт ниже
      // корпуса, а не сквозь него.
      list.push({ pts: [vec(174, 118), vec(174, GY)], net: 'GND', via: 'LED', rated: 0.012 });
    } else {
      // Индикатор висит прямо на датчике — весь ток упирается в его сто
      // килоом. Тот же нырок под селектором, что и выше, и обход резистора
      // R1: раньше дорожка падала прямо в его корпус (x=48 приходился на
      // середину R1 при подходе сверху), теперь заходит в вывод сбоку.
      list.push({ pts: [vec(-14, -88), vec(-14, -30), vec(0, -30), vec(0, 10), vec(22, 10)], net: 'SENS', via: 'LED', rated: 0.012 });
      // x=290, а не 270: прямой спуск по 270 идёт сквозь шелкографию платы
      // (она занимает x 200..280 в правом нижнем углу) — тот же приём, что
      // уже используется у коллекторной дорожки в режиме «через транзистор».
      list.push({ pts: [vec(220, 10), vec(290, 10), vec(290, GY)], net: 'GND', via: 'LED', rated: 0.012 });
    }
    return list;
  },

  topologyKey(P) { return P.SEL.choice; },

  build(c, P) {
    addSupply(c, 'VCC', 'GND', 9.0, 'V1', SUPPLY_R.BENCH);
    c.addResistor('VCC', 'SENS', 100000, 'SENSOR');
    if (P.SEL.choice === 'amp') {
      const rl = c.addResistor('VCC', 'LED_A', 470, 'RL');
      const led = addLed(c, 'LED_A', 'LEDK', 'LED', 1.8);
      const rb = c.addResistor('SENS', 'BASE', socketOhms(P.RB), 'RB');
      c.addTransistor('BASE', 'LEDK', 'GND', 'T1');
      P.RL.nets = ['VCC', 'LED_A'];
      return { RL: rl, LED: led, RB: rb };
    }
    const rl = c.addResistor('SENS', 'LED_A', 470, 'RL');
    const led = addLed(c, 'LED_A', 'GND', 'LED', 1.8);
    const rb = c.addResistor('SENS', 'BASE', socketOhms(P.RB), 'RB');
    P.RL.nets = ['SENS', 'LED_A'];
    return { RL: rl, LED: led, RB: rb };
  },

  apply(refs, P, c) { c.setResistance(refs.RB, socketOhms(P.RB)); },

  read(sol, refs, P) {
    return {
      iLed: Math.abs(sol.componentCurrent['LED'] || 0),
      iSens: Math.abs(sol.componentCurrent['SENSOR'] || 0),
      gain: Math.abs(sol.componentCurrent['LED'] || 0) / Math.max(Math.abs(sol.componentCurrent['SENSOR'] || 0), 1e-9),
      amp: P.SEL.choice === 'amp',
    };
  },

  status(m) {
    if (!m.amp) return ['Индикатор висит прямо на датчике: сто килоом пропускают доли миллиампера, светиться нечему.', 'warn'];
    if (m.iLed < 0.006) return ['Транзистор в схеме, но ток базы мал — в базе слишком много лишнего сопротивления.', 'warn'];
    return ['Индикатор горит. Датчик отдаёт микроамперы, а через индикатор идёт в сотню раз больше.', 'good'];
  },

  goal(m) {
    return {
      ok: m.iLed >= 0.006 && m.iSens <= 0.00015,
      note: 'Индикатор ' + fmtAmps(m.iLed) + ' · датчик ' + fmtAmps(m.iSens),
    };
  },

  score(m) { return clamp(m.iLed / 0.009, 0, 1); },
  scoreNote(m) { return 'Усиление примерно в ' + Math.round(m.gain) + ' раз'; },

  meter(m) {
    return [
      ['Ток индикатора', fmtAmps(m.iLed), m.iLed >= 0.006 ? 'good' : 'warn'],
      ['Ток датчика', fmtAmps(m.iSens), m.iSens <= 0.00015 ? 'good' : 'warn'],
      ['Выигрыш', m.gain > 1.5 ? '×' + Math.round(m.gain) : '—'],
      ['Схема', m.amp ? 'через транзистор' : 'напрямую'],
    ];
  },
}));
