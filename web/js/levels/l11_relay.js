'use strict';
// Уровень 11 · Пуск насоса.
// Слабая цепь управляет сильной. Изъян: кто-то «на всякий случай»
// поставил резистор в цепь катушки, и реле перестало срабатывать.

const Level11 = createLevel(LevelRegistry.register({
  id: 'pump',
  index: 25,
  title: 'Пуск насоса',
  teaches: 'реле · управление',
  silk: 'PMP-RLY-11',
  diag: 'ДИАГНОСТИКА · Реле пуска насоса не защёлкивается при нажатой кнопке.',
  brief: 'Жмёшь кнопку, а насос молчит. В цепь реле кто-то добавил лишнюю деталь.',
  lesson: 'Реле — выключатель, который нажимает маленький ток. Слабая кнопка включает мощный насос.',
  hints: [
    'Наведи курсор на катушку: посмотри, сколько тока через неё идёт и сколько нужно.',
    'Реле срабатывает от 12 мА. Посчитай, сколько остаётся после лишнего резистора.',
    'Катушка сама по себе достаточное сопротивление. Лишнее в этой цепи только мешает.',
  ],
  codex: ['relay', 'ohm', 'motor', 'switch'],
  vmax: 12.0,
  hold: 2.0,
  scale: 1.26,
  board: { x: -310, y: -138, w: 620, h: 284 },
  map: { pos: vec(-752, -300), radius: 900, color: hex(0x7fe0c0), from: 'flash', icon: { kind: 'relay' } },
  goalText: 'Держишь кнопку — насос работает.',
  scope: { label: 'Ток катушки', get: (m) => m.iCoil, min: 0, max: 0.02, band: [0.012, 0.02], fmt: fmtAmps },

  parts: [
    { id: 'SUPC', kind: 'supply', pos: vec(-232, -80), name: 'Питание управления', label: '5 В', silk: 'G1', nets: ['VC', 'GND'], comp: 'VC' },
    {
      id: 'BTN', kind: 'button', pos: vec(-80, -104), name: 'Кнопка пуска', silk: 'SB1',
      nets: ['VC', 'CTL'], comp: 'BTN', closed: false,
      interact: { type: 'press', hint: 'Держи нажатой' },
    },
    {
      id: 'RC', kind: 'socket', pos: vec(60, -98), name: 'Гнездо в цепи катушки', silk: 'R1',
      nets: ['CTL', 'COIL'], comp: 'RC', showValue: true, valueText: socketLabel,
      content: { kind: 'resistor', value: 220 }, rated: { pMax: 0.6, tau: 1.0 },
      interact: { type: 'pick', title: 'Что стоит в цепи катушки', hint: 'Нажми, чтобы заменить', options: () => socketOptions({ kit: [10, 22, 47, 100, 220, 470] }) },
    },
    {
      id: 'RLY', kind: 'relay', pos: vec(0, 10), name: 'Реле', silk: 'K1',
      nets: ['COIL', 'GND'], comp: 'K1_COIL',
      terminals: { coilA: vec(-48, 42), coilB: vec(-12, 42), comA: vec(14, 42), comB: vec(48, 42) },
    },
    { id: 'SUPP', kind: 'supply', pos: vec(-232, 66), name: 'Силовое питание', label: '12 В', silk: 'G2', nets: ['VP', 'GND'], comp: 'VP' },
    {
      id: 'PUMP', kind: 'motor', pos: vec(190, 44), name: 'Насос', silk: 'M1',
      nets: ['PMP', 'GND'], comp: 'PUMP', rated: { iNom: 0.25, pMax: 6, tau: 0.9 },
    },
  ],

  wires: [
    { pts: [vec(-168, -98), vec(-168, -98), vec(-110, -98)], net: 'VC', via: 'BTN', rated: 0.02 },
    { pts: [vec(-50, -98), vec(16, -98)], net: 'CTL', via: 'RC', rated: 0.02 },
    { pts: [vec(104, -98), vec(150, -98), vec(150, -30), vec(-48, -30), vec(-48, 52)], net: 'COIL', via: 'COIL', rated: 0.02 },
    // y=100, а не 118: ниже 118 обратный провод проходил прямо по
    // шелкографии «PMP-RLY-11» в углу платы.
    // Земляной рельс идёт по x=-154, а не по x=-168. На -168 он проходил
    // ровно через ПЛЮСОВОЙ вывод силового питания (-168,48): конец провода
    // VP лежал на пути провода GND, wireJunctions видел это как узел и
    // ставил там паяный пятак — картинка утверждала, что плюс 12 В посажен
    // на землю. Решателю всё равно (провода здесь декоративные), потому в
    // логе и на приборах ничего не проявлялось. К минусам обоих блоков
    // питания рельс теперь подходит явными отводами.
    { pts: [vec(-12, 52), vec(-12, 100), vec(-154, 100), vec(-154, -62), vec(-168, -62)], net: 'GND', via: 'COIL', rated: 0.02 },
    { pts: [vec(-154, 84), vec(-168, 84)], net: 'GND', via: 'PUMP', rated: 0.3 },
    { pts: [vec(-168, 48), vec(14, 48), vec(14, 52)], net: 'VP', via: 'PUMP', rated: 0.3 },
    { pts: [vec(48, 52), vec(48, 66), vec(147, 66)], net: 'PMP', via: 'PUMP', rated: 0.3 },
    { pts: [vec(233, 66), vec(270, 66), vec(270, 100), vec(-12, 100)], net: 'GND', via: 'PUMP', rated: 0.3 },
  ],

  build(c) {
    addSupply(c, 'VC', 'GND', 5.0, 'VC', SUPPLY_R.BENCH);
    addSupply(c, 'VP', 'GND', 12.0, 'VP', SUPPLY_R.BENCH);
    const btn = c.addSwitch('VC', 'CTL', false, 'BTN');
    const rc = c.addResistor('CTL', 'COIL', 220, 'RC');
    const relay = makeRelay(c, 'COIL', 'GND', 'VP', 'PMP', 'K1', { coilOhms: 400, pullIn: 0.012, dropOut: 0.008 });
    const pump = addMotor(c, 'PMP', 'GND', 47.0, 'PUMP');
    return { BTN: btn, RC: rc, RELAY: relay, COIL: relay.coil, PUMP: pump };
  },

  apply(refs, P, c) {
    c.setSwitch(refs.BTN, P.BTN.closed);
    c.setResistance(refs.RC, socketOhms(P.RC));
  },

  // Якорь реле — механика, а не электрика: решаем его отдельно, по току
  // катушки, и уже потом рассказываем матрице, замкнут ли контакт.
  tick(dt, P, m, refs, c) {
    const closed = refs.RELAY.update(c, m.iCoil, dt);
    P.RLY.closedNow = closed;
    P.RLY.pull = refs.RELAY.pull;
  },

  read(sol, refs, P) {
    return {
      iCoil: Math.abs(sol.componentCurrent['K1_COIL'] || 0),
      iPump: Math.abs(sol.componentCurrent['PUMP'] || 0),
      closed: !!P.RLY.closedNow,
      pressed: P.BTN.closed,
    };
  },

  partView(part, m, P) {
    if (part.id !== 'RLY') return null;
    return { pull: P.RLY.pull || 0 };
  },

  status(m) {
    if (!m.pressed) return ['Нажми и держи кнопку пуска — отпущенная, она держит цепь управления разомкнутой.', 'neutral'];
    if (!m.closed) return ['Кнопка нажата, ток через катушку идёт, но его не хватает: якорь не притягивается.', 'warn'];
    return ['Реле щёлкнуло, насос пошёл. ' + fmtAmps(m.iCoil) + ' управляют ' + fmtAmps(m.iPump) + '.', 'good'];
  },

  goal(m) {
    return {
      ok: m.closed && m.iPump > 0.2 && m.iCoil <= 0.02,
      note: 'Катушка ' + fmtAmps(m.iCoil) + ' (нужно от 12 мА) · насос ' + fmtAmps(m.iPump),
    };
  },

  score(m) { return m.closed ? clamp(m.iPump / 0.25, 0, 1) : 0; },
  scoreNote(m) { return 'Управление ' + fmtAmps(m.iCoil) + ' → нагрузка ' + fmtAmps(m.iPump) + ', выигрыш примерно в ' + Math.round(m.iPump / Math.max(m.iCoil, 1e-6)) + ' раз'; },

  meter(m) {
    return [
      ['Ток катушки', fmtAmps(m.iCoil), m.iCoil >= 0.012 ? 'good' : 'warn'],
      ['Порог срабатывания', '12 мА'],
      ['Контакт', m.closed ? 'замкнут' : 'разомкнут', m.closed ? 'good' : ''],
      ['Ток насоса', fmtAmps(m.iPump), m.iPump > 0.2 ? 'good' : ''],
    ];
  },
}));
