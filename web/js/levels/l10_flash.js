'use strict';
// Уровень 10 · Вспышка.
// Первый уровень, где важно ЖДАТЬ. Источник не может отдать полтора
// ампера сам — но конденсатор может, если ему дать набраться.

const Level10 = createLevel(LevelRegistry.register({
  id: 'flash',
  index: 24,
  title: 'Импульсная вспышка',
  teaches: 'конденсатор · время',
  silk: 'FLS-CAP-10',
  diag: 'ДИАГНОСТИКА · Импульсная вспышка не набирает пиковый ток.',
  brief: 'Вспышка еле светит. Дай конденсатору зарядиться, потом жми спуск.',
  lesson: 'Конденсатор копит заряд не сразу, а отдаёт весь разом. Поэтому вспышка ярче, чем может дать батарея.',
  hints: [
    'Замкни ключ заряда и смотри на ленту: напряжение на конденсаторе растёт не сразу.',
    'Спуск нажимают, когда конденсатор набрал почти всё. Раньше — вспышка будет тусклой.',
    'Если ждать надоело — посмотри, через какое сопротивление идёт заряд.',
  ],
  codex: ['capacitor', 'rc', 'power', 'lamp'],
  vmax: 9.0,
  hold: 0,
  // Победа здесь — последовательность во времени (накопить, потом дать
  // вспышку), а не состояние деталей: перебор состояний её не найдёт.
  // web/tests/levels.test.js берёт минимальный зачтённый результат отсюда.
  sequenced: true,
  minScore: 1.2 / 1.8,
  scale: 1.32,
  board: { x: -300, y: -128, w: 600, h: 256 },
  map: { pos: vec(-537, -300), radius: 900, color: hex(0x8fd0ff), from: ['switchboard', 'motor'], icon: { kind: 'capacitor', value: 4700e-6 } },
  goalText: 'Сделай яркую вспышку.',
  scope: { label: 'Напряжение на конденсаторе', get: (m) => m.uCap, min: 0, max: 9, band: [7.6, 9], fmt: fmtVolts },

  parts: [
    { id: 'SUP', kind: 'supply', pos: vec(-230, -66), name: 'Питание вспышки', label: '9 В', silk: 'G1', nets: ['VCC', 'GND'], comp: 'V1' },
    {
      id: 'SWC', kind: 'toggle', pos: vec(-70, -94), name: 'Ключ заряда', silk: 'SA1',
      nets: ['VCC', 'CHG'], comp: 'SWC', closed: false,
      interact: { type: 'toggle', hint: 'Нажми, чтобы включить или выключить заряд' },
    },
    {
      id: 'RCH', kind: 'socket', pos: vec(70, -86), name: 'Зарядный резистор', silk: 'R1',
      nets: ['CHG', 'CAP'], comp: 'RCH', showValue: true, valueText: socketLabel,
      content: { kind: 'resistor', value: 470 }, rated: { pMax: 1.5, tau: 1.0 },
      interact: { type: 'pick', title: 'Через что заряжать', hint: 'Нажми, чтобы сменить номинал', options: () => socketOptions({ empty: false, jumper: false, kit: [47, 100, 220, 470, 1000, 2200] }) },
    },
    {
      id: 'CAP', kind: 'capacitor', pos: vec(190, -60), name: 'Накопитель', silk: 'C1',
      value: 4700e-6, label: '4700 мкФ', vMax: 9,
      nets: ['CAP', 'GND'], comp: 'CAP',
    },
    {
      id: 'BTN', kind: 'button', pos: vec(-70, 46), name: 'Спуск', silk: 'SB1',
      nets: ['CAP', 'FL'], comp: 'FIRE', closed: false,
      interact: { type: 'press', hint: 'Держи нажатой, чтобы дать вспышку' },
    },
    {
      id: 'FLASH', kind: 'lamp', pos: vec(90, 52), name: 'Лампа-вспышка', silk: 'HL1',
      nets: ['FL', 'GND'], comp: 'FLASH',
      rated: { pNom: 8.0, pMax: 900, tau: 0.15 },
    },
  ],

  wires: [
    { pts: [vec(-166, -84), vec(-166, -86), vec(-108, -86)], net: 'VCC', via: 'SWC', rated: 0.02 },
    { pts: [vec(-32, -86), vec(26, -86)], net: 'CHG', via: 'RCH', rated: 0.02 },
    { pts: [vec(114, -86), vec(176, -86), vec(176, -18)], net: 'CAP', via: 'RCH', rated: 0.02 },
    // y=84, а не 46: по прямой на 46 дорожка от накопителя до спуска шла
    // ровно сквозь корпус лампы-вспышки (её габарит x 56..124, y 26..78).
    // Обходим лампу снизу, ниже её нижнего края, и только потом поднимаемся
    // к выводу кнопки.
    { pts: [vec(176, -18), vec(176, 84), vec(-32, 84), vec(-32, 46)], net: 'CAP', via: 'FIRE', dir: -1, rated: 1.8 },
    { pts: [vec(204, -18), vec(240, -18), vec(240, 94)], net: 'GND', via: 'V1', dir: -1, rated: 0.02 },
    { pts: [vec(-108, 46), vec(-148, 46), vec(-148, 94), vec(-166, 94), vec(-166, -48)], net: 'GND', via: 'FIRE', rated: 1.8 },
    // Раньше здесь связи не было вовсе: старая (кривая) дорожка от
    // накопителя до спуска шла прямо сквозь корпус лампы и по пути
    // проходила достаточно близко к её левому выводу (FLASH.a), чтобы
    // выглядеть подключённой — на самом деле это было совпадение, а не
    // провод к этому выводу. После того как та дорожка обошла лампу
    // стороной, вывод обнажился по-настоящему пустым. FL идёт от кнопки
    // спуска (BTN.a) прямо к нему.
    { pts: [vec(-100, 52), vec(56, 52)], net: 'FL', via: 'FLASH', rated: 1.8 },
    { pts: [vec(124, 52), vec(240, 52)], net: 'GND', via: 'FLASH', rated: 1.8 },
    { pts: [vec(240, 94), vec(-148, 94)], net: 'GND', via: 'V1', rated: 0.02 },
  ],

  build(c) {
    addSupply(c, 'VCC', 'GND', 9.0, 'V1', SUPPLY_R.BENCH);
    const swc = c.addSwitch('VCC', 'CHG', false, 'SWC');
    const rch = c.addResistor('CHG', 'CAP', 470, 'RCH');
    const cap = c.addCapacitor('CAP', 'GND', 4700e-6, 'CAP');
    const fire = c.addSwitch('CAP', 'FL', false, 'FIRE');
    const flash = addLamp(c, 'FL', 'GND', 4.0, 'FLASH');
    return { SWC: swc, RCH: rch, CAP: cap, FIRE: fire, FLASH: flash };
  },

  apply(refs, P, c) {
    c.setSwitch(refs.SWC, P.SWC.closed);
    c.setResistance(refs.RCH, socketOhms(P.RCH));
    c.setSwitch(refs.FIRE, P.BTN.closed);
  },

  // Вспышка — событие, а не режим: её пик надо запомнить, иначе к
  // следующему кадру он уже прошёл и мерить нечего.
  tick(dt, P, m, refs, c, api) {
    if (m.peak > 1.2 && !P.FLASH.fired) {
      P.FLASH.fired = true;
      api.flash('Есть вспышка: ' + fmtAmps(m.peak), 'good');
    }
  },

  read(sol, refs, P) {
    return {
      uCap: sol.nodeVoltage['CAP'] || 0,
      iCharge: Math.abs(sol.componentCurrent['RCH'] || 0),
      iFlash: Math.abs(sol.componentCurrent['FLASH'] || 0),
      peak: P.FLASH.iMax || 0,
      fired: !!P.FLASH.fired,
      ratio: clamp((sol.nodeVoltage['CAP'] || 0) / 9, 0, 1),
    };
  },

  status(m, P) {
    if (m.iFlash > 0.2) return ['Вспышка! Конденсатор отдаёт всё, что накопил.', 'good'];
    if (m.fired) return ['Вспышка засчитана. Можно повторить: накопитель заряжается заново.', 'good'];
    if (!P.SWC.closed && m.uCap < 0.5) return ['Накопитель пуст, ключ заряда разомкнут.', 'neutral'];
    if (m.ratio < 0.85) return ['Заряжается… ' + Math.round(m.ratio * 100) + '%. Рано.', 'warn'];
    return ['Накоплено ' + Math.round(m.ratio * 100) + '%. Можно снимать — жми спуск.', 'good'];
  },

  goal(m) {
    return {
      ok: m.peak >= 1.2,
      note: m.peak > 0.01 ? 'Лучшая вспышка: ' + fmtAmps(m.peak) + ', нужно 1,2 А' : 'Вспышки ещё не было.',
    };
  },

  score(m) { return clamp(m.peak / 1.8, 0, 1); },
  scoreNote(m) { return 'Пиковый ток вспышки ' + fmtAmps(m.peak) + ' — источник сам столько не даёт и близко'; },

  meter(m) {
    return [
      ['Заряд накопителя', Math.round(m.ratio * 100) + '%', m.ratio > 0.85 ? 'good' : 'warn'],
      ['На конденсаторе', fmtVolts(m.uCap)],
      ['Ток заряда', fmtAmps(m.iCharge)],
      ['Ток вспышки', fmtAmps(m.iFlash), m.iFlash > 1 ? 'good' : ''],
      ['Лучшая вспышка', fmtAmps(m.peak), m.peak >= 1.2 ? 'good' : ''],
    ];
  },
}));
