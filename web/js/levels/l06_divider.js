'use strict';
// Уровень 6 · Опорное напряжение.
// Делитель: два резистора подряд делят напряжение в отношении своих
// сопротивлений. Отношение задаёт вольты, а сами номиналы — сколько тока
// уходит впустую. Оба условия надо выполнить одновременно.

const Level06 = createLevel(LevelRegistry.register({
  id: 'divider',
  index: 20,
  title: 'Опорное напряжение',
  teaches: 'делитель напряжения',
  silk: 'REF-DIV-06',
  diag: 'ДИАГНОСТИКА · На датчик подано напряжение вне допуска.',
  brief: 'Датчику нужно 3,6 вольта, а батарея даёт 9. Получи меньшее из большего.',
  lesson: 'Два резистора подряд делят напряжение: на большем остаётся больше. Меняя пару, получаешь нужные вольты.',
  hints: [
    'Верхний резистор должен быть чуть больше нижнего — в полтора раза.',
    'Пар с нужным отношением в ящике несколько. Посмотри на ток, который при этом течёт через делитель.',
    'Чем крупнее оба номинала, тем меньше тока уходит зря. Ищи пару с отношением 3:2 и суммой в несколько сотен ом.',
  ],
  codex: ['divider', 'ohm', 'series', 'power'],
  vmax: 9.0,
  hold: 2.5,
  scale: 1.3,
  board: { x: -300, y: -135, w: 600, h: 270 },
  map: { pos: vec(108, -535), radius: 900, color: hex(0x9fd0ff), from: ['panel', 'fuse_box'], icon: { kind: 'resistor', value: 220 } },
  goalText: 'На датчике нужное напряжение — бегунок в зелёной зоне.',
  gauge: { lowWord: 'мало вольт', highWord: 'много вольт', low: 'Мало вольт — нижний резистор побольше.', high: 'Много вольт — верхний резистор побольше.' },
  scope: { label: 'Напряжение на датчике', get: (m) => m.uOut, min: 0, max: 9, band: [3.4, 3.8], fmt: fmtVolts },

  parts: [
    { id: 'SUP', kind: 'supply', pos: vec(-230, -30), name: 'Питание прибора', label: '9 В', silk: 'G1', nets: ['VCC', 'GND'], comp: 'V1' },
    {
      id: 'R1', kind: 'socket', pos: vec(-40, -90), name: 'Верхнее плечо',
      silk: 'R1', nets: ['VCC', 'OUT'], comp: 'R1', showValue: true, valueText: socketLabel,
      content: { kind: 'resistor', value: 100 }, rated: { pMax: 1.2, tau: 1.0 },
      interact: { type: 'pick', title: 'Верхнее плечо делителя', hint: 'Нажми, чтобы сменить номинал', options: () => socketOptions({ jumper: false }) },
    },
    { id: 'OUTN', kind: 'node', pos: vec(60, -90), name: 'Средняя точка', label: '3,6 В?', nets: ['OUT', 'GND'] },
    {
      id: 'R2', kind: 'socket', pos: vec(160, -90), name: 'Нижнее плечо',
      silk: 'R2', nets: ['OUT', 'GND'], comp: 'R2', showValue: true, valueText: socketLabel,
      content: { kind: 'resistor', value: 100 }, rated: { pMax: 1.2, tau: 1.0 },
      interact: { type: 'pick', title: 'Нижнее плечо делителя', hint: 'Нажми, чтобы сменить номинал', options: () => socketOptions({ jumper: false }) },
    },
    { id: 'LOAD', kind: 'device', pos: vec(106, 30), name: 'Датчик', label: 'датчик', silk: 'A1', nets: ['OUT', 'GND'], comp: 'LOAD' },
  ],

  wires: [
    { pts: [vec(-166, -48), vec(-166, -90), vec(-84, -90)], net: 'VCC', via: 'R1', rated: 0.04 },
    { pts: [vec(4, -90), vec(116, -90)], net: 'OUT', via: 'R2', rated: 0.04 },
    { pts: [vec(60, -90), vec(60, 30)], net: 'OUT', via: 'LOAD', rated: 0.005 },
    { pts: [vec(152, 30), vec(250, 30), vec(250, -90), vec(204, -90)], net: 'GND', via: 'R2', rated: 0.04 },
    // dir: -1 — дорожка нарисована от нагрузки к минусу источника, а ток
    // источника при отдаче отрицателен: без пометки огоньки побегут обратно.
    { pts: [vec(250, 30), vec(250, 90), vec(-166, 90), vec(-166, -12)], net: 'GND', via: 'V1', dir: -1, rated: 0.05 },
  ],

  build(c) {
    addSupply(c, 'VCC', 'GND', 9.0, 'V1', SUPPLY_R.BENCH);
    const r1 = c.addResistor('VCC', 'OUT', 100, 'R1');
    const r2 = c.addResistor('OUT', 'GND', 100, 'R2');
    // Нагрузка не бесконечно лёгкая: она подсаживает делитель, и это
    // видно на приборе — ровно тот подвох, ради которого уровень и нужен.
    const load = c.addResistor('OUT', 'GND', 2200, 'LOAD');
    return { R1: r1, R2: r2, LOAD: load };
  },

  apply(refs, P, c) {
    c.setResistance(refs.R1, socketOhms(P.R1));
    c.setResistance(refs.R2, socketOhms(P.R2));
  },

  read(sol) {
    return {
      uOut: sol.nodeVoltage['OUT'] || 0,
      iDiv: Math.abs(sol.componentCurrent['R1'] || 0),
      iLoad: Math.abs(sol.componentCurrent['LOAD'] || 0),
      pTotal: Math.abs(sol.componentCurrent['V1'] || 0) * 9,
    };
  },

  status(m, P) {
    if (!P.R1.content || !P.R2.content) return ['Одно из плеч пустое — делителя нет.', 'neutral'];
    if (m.uOut > 3.8) return ['Многовато. Верхнее плечо должно забирать больше, чем сейчас.', 'warn'];
    if (m.uOut < 3.4) return ['Маловато. Нижнее плечо забирает слишком мало.', 'warn'];
    if (m.iDiv > 0.04) return ['Напряжение верное, но делитель жрёт слишком много тока впустую. Номиналы надо крупнее — при том же отношении.', 'warn'];
    return ['Три с половиной с лишним вольта, и ток разумный. Так и надо.', 'good'];
  },

  goal(m) {
    const vOk = m.uOut >= 3.4 && m.uOut <= 3.8;
    return {
      ok: vOk && m.iDiv <= 0.04,
      note: fmtVolts(m.uOut) + ' на датчике · делитель тратит ' + fmtAmps(m.iDiv),
    };
  },

  score(m) {
    if (!(m.uOut >= 3.4 && m.uOut <= 3.8)) return 0;
    return clamp(1 - (m.iDiv - 0.02) / 0.05, 0.5, 1);
  },
  scoreNote(m) { return 'Ток делителя ' + fmtAmps(m.iDiv) + ' · через датчик ' + fmtAmps(m.iLoad); },

  meter(m, P) {
    return [
      ['На датчике', fmtVolts(m.uOut), m.uOut >= 3.4 && m.uOut <= 3.8 ? 'good' : 'warn'],
      ['Ток делителя', fmtAmps(m.iDiv), m.iDiv > 0.04 ? 'bad' : 'good'],
      ['Ток датчика', fmtAmps(m.iLoad)],
      ['Верхнее плечо', socketLabel(P.R1) || '—'],
      ['Нижнее плечо', socketLabel(P.R2) || '—'],
    ];
  },
}));
